import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import type { StringKey } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

export async function sendOtp(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyOtp(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  queryClient.clear();
}

/** Turns an auth error into a message key people can act on. */
export function authErrorKey(error: unknown, fallback: StringKey): StringKey {
  if (isAuthRetryableFetchError(error)) return 'common.networkError';
  if (isAuthApiError(error) && error.status === 429) return 'signIn.tooManyRequests';
  return fallback;
}
