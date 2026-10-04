import { formatGrams } from '@/features/requests/weight';
import { t, type StringKey } from '@/i18n';

import { formatPaise } from './money';

type DbError = { code?: string; details?: string | null };

/**
 * Turns a database rule error into a message people can act on. The HB0xx codes
 * are listed at the top of the item_requests, travelers, offers, payments and delivery
 * migrations;
 * the lower-case ones come from the Edge Functions.
 */
export function dbErrorMessage(error: unknown, fallback: StringKey): string {
  const { code, details } = (error ?? {}) as DbError;
  switch (code) {
    case 'HB001':
      return t('requests.errors.blocked', { reason: blockedReason(details) });
    case 'HB002':
      return t('requests.errors.categoryNotAllowed');
    case 'HB003':
      return t('requests.errors.tooHeavy', { max: formatGrams(Number(details) || 0) });
    case 'HB004':
      return t('requests.errors.sameState');
    case 'HB005':
      return t('requests.errors.deadlineRange');
    case 'HB006':
      return t('trips.errors.dateRange', { days: details ?? '' });
    case 'HB007': {
      const [items, grams] = (details ?? '').split(',');
      return t('trips.errors.overLimit', {
        items: items ?? '',
        weight: formatGrams(Number(grams) || 0),
      });
    }
    case 'HB010':
      return t('errors.alreadyChanged');
    case 'HB011':
      return t('errors.notFound');
    case 'HB012':
      return t('errors.adminsOnly');
    case 'HB013':
      return t('verify.errors.alreadySubmitted');
    case 'HB014':
      return t('admin.reasonRequired');
    case 'HB015': {
      const [min, max] = (details ?? '').split(',').map(Number);
      return t('offers.fareOutOfBand', { min: formatPaise(min || 0), max: formatPaise(max || 0) });
    }
    case 'HB016':
      return t('offers.errors.cannotCarry');
    case 'HB017':
      return t('offers.errors.routeMismatch');
    case 'HB018': {
      const [items, grams] = (details ?? '').split(',').map(Number);
      return t('offers.errors.tripFull', {
        items: Math.max(0, items || 0),
        weight: formatGrams(Math.max(0, grams || 0)),
      });
    }
    case 'HB019':
      return t('offers.errors.ownRequest');
    case 'HB021':
      return t('offers.errors.tripHasItems');
    case '23505':
      return t('offers.errors.alreadyOffered');
    case 'HB022':
      return t('payment.errors.notReady');
    case 'HB023':
      return t('payment.errors.mismatch');
    case 'HB024':
      return t('payment.errors.cannotRefund');
    case 'HB025':
      return t('delivery.noCodeYet');
    case 'HB026':
      return t('delivery.codeLocked');
    case 'HB027':
      return t('dispute.reasonShort');
    case 'HB028':
      return t('chat.phoneBlocked');
    // Edge Function codes (supabase/functions/_shared/http.ts)
    case 'bad_signature':
      return t('payment.errors.badSignature');
    case 'not_captured':
      return t('payment.errors.notCaptured');
    case 'payment_provider_error':
      return t('payment.errors.provider');
    case 'unauthorized':
      return t('payment.errors.signedOut');
    default:
      return t(fallback);
  }
}

export function blockedReason(reasonCode: string | null | undefined): string {
  const key = `blockedReasons.${reasonCode}` as StringKey;
  const text = t(key);
  return text === key ? t('blockedReasons.other') : text;
}
