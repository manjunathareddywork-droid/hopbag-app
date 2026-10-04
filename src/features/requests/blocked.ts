import type { BlockedTerm } from '@/lib/database.types';

/**
 * Same matching as public.find_blocked_term in the database: each pattern is a
 * whole-word, case-insensitive match. The app checks first so people see the
 * reason straight away; the database check is the one that cannot be skipped.
 */
export function findBlockedTerm(text: string, terms: BlockedTerm[]): BlockedTerm | null {
  return terms.find((term) => new RegExp(`\\b(${term.pattern})\\b`, 'i').test(text)) ?? null;
}
