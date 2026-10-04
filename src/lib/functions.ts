import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/** Error from an Edge Function, shaped like a database error so dbErrorMessage can explain it. */
export class FunctionError extends Error {
  constructor(
    readonly code: string,
    readonly details: string | null,
  ) {
    super(code);
  }
}

/** Calls a Supabase Edge Function with the signed-in user's token. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => null);
      throw new FunctionError(
        payload?.error?.code ?? 'internal_error',
        payload?.error?.details ?? null,
      );
    }
    throw error;
  }
  return data as T;
}
