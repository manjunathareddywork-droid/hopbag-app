// Deno-only helpers for the Edge Functions: env, Supabase service client, auth,
// JSON responses and error mapping.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { RazorpayClient, RazorpayError } from './razorpay.ts';

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
}

/** Service-role client: bypasses RLS. Only ever used inside Edge Functions. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function razorpay(): RazorpayClient {
  return new RazorpayClient(env('RAZORPAY_KEY_ID'), env('RAZORPAY_KEY_SECRET'));
}

/** Error the app can show: `code` matches the database HB0xx codes where possible. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: string | null = null,
  ) {
    super(code);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Turns a Postgres error from an RPC into an HttpError with the same code. */
export function dbError(error: { code?: string; details?: string | null; message?: string }) {
  const code = error.code ?? 'db_error';
  const status = code === 'HB011' ? 404 : code.startsWith('HB') ? 409 : 500;
  return new HttpError(status, code, error.details ?? null);
}

/** The signed-in user calling this function (verified by Supabase Auth). */
export async function requireUser(req: Request, db: SupabaseClient): Promise<{ id: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'unauthorized');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthorized');
  return { id: data.user.id };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'bad_request');
  }
}

/** Wraps a handler: POST only, errors become JSON, nothing secret is leaked. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: { code: e.code, details: e.details } }, e.status);
      }
      if (e instanceof RazorpayError) {
        console.error('Razorpay error', e.status, JSON.stringify(e.body));
        return json({ error: { code: 'payment_provider_error' } }, 502);
      }
      console.error(e);
      return json({ error: { code: 'internal_error' } }, 500);
    }
  };
}
