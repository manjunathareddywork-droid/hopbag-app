import { t, type StringKey } from '@/i18n';

import { formatGrams } from './weight';

type DbError = { code?: string; details?: string | null };

/** Turns a database rule error (HB0xx codes, see the item_requests migration) into a message. */
export function requestErrorMessage(error: unknown, fallback: StringKey): string {
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
    case 'HB010':
      return t('requests.errors.statusChange');
    case 'HB011':
      return t('requests.errors.notFound');
    default:
      return t(fallback);
  }
}

export function blockedReason(reasonCode: string | null | undefined): string {
  const key = `blockedReasons.${reasonCode}` as StringKey;
  const text = t(key);
  return text === key ? t('blockedReasons.other') : text;
}
