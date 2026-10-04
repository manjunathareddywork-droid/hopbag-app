import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Our own error and event logging (public.app_errors / public.app_events) instead
 * of a third-party service. Fire-and-forget: logging never throws or blocks the UI.
 * Native crashes (the app closing without a JavaScript error) are not captured.
 */

export type EventName =
  | 'app_opened'
  | 'otp_requested'
  | 'signed_in'
  | 'onboarding_completed'
  | 'request_form_opened'
  | 'request_posted'
  | 'feed_opened'
  | 'offer_sent'
  | 'offer_accepted'
  | 'checkout_opened'
  | 'payment_completed'
  | 'payment_failed'
  | 'pickup_marked'
  | 'delivery_confirmed'
  | 'chat_opened'
  | 'rating_sent'
  | 'report_sent'
  | 'user_blocked';

const appVersion = Constants.expoConfig?.version ?? null;

/** Masks runs of 5+ digits (phone numbers, codes, PNRs) and trims to a size. */
export function scrub(text: string, max: number): string {
  return text.replace(/\d[\d\s-]{3,}\d/g, '#').slice(0, max);
}

/** Groups the same error together: message + first stack frame, hashed (djb2). */
export function fingerprint(message: string, stack?: string): string {
  const firstFrame = stack?.split('\n').find((line) => line.includes('at ')) ?? '';
  const input = `${message}|${firstFrame.trim()}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16);
}

/** Database rule errors (HBxxx, constraint codes) are expected, not bugs. */
function isExpected(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return /^HB\d{3}$/.test(code) || /^(23|42)\d{3}$/.test(code);
}

export function reportError(
  error: unknown,
  context: { kind?: 'crash' | 'error' | 'promise'; screen?: string } = {},
): void {
  if (isExpected(error)) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = scrub(err.message || err.name || 'Unknown error', 1000);
    supabase
      .from('app_errors')
      .insert({
        kind: context.kind ?? 'error',
        message,
        stack: err.stack ? scrub(err.stack, 8000) : null,
        screen: context.screen?.slice(0, 200) ?? null,
        fingerprint: fingerprint(message, err.stack),
        app_version: appVersion,
        platform: Platform.OS,
        os_version: String(Platform.Version).slice(0, 32),
        device_model: Device.modelName?.slice(0, 64) ?? null,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Logging must never break the app.
  }
}

/** Funnel events. Properties must never hold personal data (names, phones, text). */
export function track(name: EventName, properties: Record<string, string | number | boolean> = {}) {
  try {
    supabase
      .from('app_events')
      .insert({ name, properties, app_version: appVersion, platform: Platform.OS })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Logging must never break the app.
  }
}

/** Catches errors nothing else handled (outside React rendering). */
export function installGlobalErrorHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { kind: isFatal ? 'crash' : 'error', screen: 'global' });
    previous(error, isFatal);
  });
}

type ErrorUtilsType = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};
