import { t } from '@/i18n';

/** Dates are plain "YYYY-MM-DD" strings in India time, matching Postgres `date`. */

const IST_OFFSET_MS = 330 * 60 * 1000;

export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Local-midnight Date for date pickers. */
export function isoToLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-10" -> "10 Oct 2026". Month names come from the strings file. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const months = t('common.monthsShort').split(',');
  return `${d} ${months[m - 1]} ${y}`;
}
