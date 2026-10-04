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

/**
 * Turns a Postgres error from an RPC into an HttpError. Only our own rule errors
 * (HBxxx) pass their code and details to the app; anything else is logged here
 * and returned as a generic error, so database internals never reach clients.
 */
export function dbError(error: { code?: string; details?: string | null; message?: string }) {
  const code = error.code ?? '';
  if (/^HB\d{3}$/.test(code)) {
    return new HttpError(
      code === 'HB011' ? 404 : code === 'HB032' ? 429 : 409,
      code,
      error.details ?? null,
    );
  }
  if (code === '22P02') return new HttpError(400, 'bad_request'); // malformed id
  console.error('Database error', code, error.message);
  return new HttpError(500, 'internal_error');
}

/** The signed-in user calling this function (verified by Supabase Auth). */
export async function requireUser(req: Request, db: SupabaseClient): Promise<{ id: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'unauthorized');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthorized');
  return { id: data.user.id };
}

/**
 * Per-user limit for this function (fixed window, counted in public.rate_limits).
 * Over the limit -> 429 with code HB032, which the app explains.
 */
export async function rateLimit(
  db: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await db.rpc('hit_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (data !== true) throw new HttpError(429, 'HB032');
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
