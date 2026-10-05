import { t, type StringKey } from '@/i18n';
import { blockedReason } from '@/lib/db-errors';

import { formatGrams } from './weight';

/** Translates schema messages, including the two that carry a value. */
export function requestFormError(message?: string): string | undefined {
  if (!message) return undefined;
  const [key, value] = message.split(':');
  if (key === 'blocked') return t('requests.errors.blocked', { reason: blockedReason(value) });
  if (key === 'tooHeavy') return t('requests.errors.tooHeavy', { max: formatGrams(Number(value)) });
  return t(message as StringKey);
}
