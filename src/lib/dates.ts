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

/** Timestamp -> "10 Oct, 4:05 pm" in the phone's time zone. */
export function formatDateTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const months = t('common.monthsShort').split(',');
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${d.getDate()} ${months[d.getMonth()]}, ${h12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

/** "2026-10-09" -> "Fri 9 Oct" (designs' short form; no year). */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = t('common.weekdays').split(',')[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${t('common.monthsShort').split(',')[m - 1]}`;
}

/** "2026-10-14" -> "14 Oct". */
export function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${t('common.monthsShort').split(',')[m - 1]}`;
}

/** Timestamp -> "2:14 pm" today, "Yesterday", "Mon" this week, else "7 Oct". */
export function formatWhen(isoTimestamp: string, now: Date = new Date()): string {
  const d = new Date(isoTimestamp);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) {
    const h = d.getHours();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.weekdays').split(',')[d.getDay()];
  return `${d.getDate()} ${t('common.monthsShort').split(',')[d.getMonth()]}`;
}

/** Timestamp -> "12 min ago", "1 hour ago", "5 hours ago", then formatWhen. */
export function formatAgo(isoTimestamp: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(isoTimestamp).getTime()) / 60000);
  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('common.minAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t('common.hourAgo');
  if (hours < 24 && new Date(isoTimestamp).getDate() === now.getDate()) {
    return t('common.hoursAgo', { n: hours });
  }
  return formatWhen(isoTimestamp, now);
}

/** Timestamp -> "Today, 11:42 am" or "Tue 6 Oct, 10:05 am". */
export function formatStamp(isoTimestamp: string, now: Date = new Date()): string {
  const d = new Date(isoTimestamp);
  const h = d.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  if (d.toDateString() === now.toDateString()) return `${t('common.today')}, ${time}`;
  const weekday = t('common.weekdays').split(',')[d.getDay()];
  return `${weekday} ${d.getDate()} ${t('common.monthsShort').split(',')[d.getMonth()]}, ${time}`;
}
