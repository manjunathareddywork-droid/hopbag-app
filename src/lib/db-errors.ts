import { formatGrams } from '@/features/requests/weight';
import { t, type StringKey } from '@/i18n';

type DbError = { code?: string; details?: string | null };

/**
 * Turns a database rule error into a message people can act on. The HB0xx codes
 * are listed at the top of the item_requests and travelers migrations.
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
    default:
      return t(fallback);
  }
}

export function blockedReason(reasonCode: string | null | undefined): string {
  const key = `blockedReasons.${reasonCode}` as StringKey;
  const text = t(key);
  return text === key ? t('blockedReasons.other') : text;
}
