import type { RequestStatus } from '@/lib/database.types';

/**
 * Same rule as public.contains_phone_number: join digits split by spaces, dots,
 * dashes or brackets, then look for an Indian mobile number (optional +91 or 0).
 */
export function containsPhoneNumber(text: string): boolean {
  const joined = text.replace(/(\d)[\s().-]+(?=\d)/g, '$1');
  return /(^|\D)(\+?91|0)?[6-9]\d{9}(?!\d)/.test(joined);
}

/** Same as public.phone_sharing_allowed: only once the payment is held. */
export function phoneSharingAllowed(status: RequestStatus): boolean {
  return ['paid', 'picked_up', 'delivered', 'disputed', 'settled'].includes(status);
}

/** Same as public.chat_open. */
export function chatOpen(status: RequestStatus): boolean {
  return ['accepted', 'paid', 'picked_up', 'delivered', 'disputed'].includes(status);
}
