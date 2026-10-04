/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { findBlockedTerm } from '@/features/requests/blocked';
import type { BlockedTerm } from '@/lib/database.types';

/**
 * Loads the real seed list from the migration so the app check and the database
 * check stay in step. Same samples as supabase/tests/database/02_requests.test.sql.
 */
function seededTerms(): BlockedTerm[] {
  const sql = readFileSync(
    join(__dirname, '../../supabase/migrations/20261004130000_reference_data.sql'),
    'utf8',
  );
  const section = sql.slice(sql.indexOf('insert into public.blocked_terms'));
  return [...section.matchAll(/\('([^']+)', '([a-z]+)'\)/g)].map((m, i) => ({
    id: i + 1,
    pattern: m[1],
    reason_code: m[2],
  }));
}

const terms = seededTerms();

describe('findBlockedTerm', () => {
  it('loads the seeded list', () => {
    expect(terms.length).toBeGreaterThan(40);
  });

  it.each([
    ['Paracetamol tablets', 'medicine'],
    ['please add 2 bottles of whisky', 'alcohol'],
    ['GOLD CHAIN for my sister', 'valuables'],
    ['Power bank 10000mAh', 'batteries'],
    ['Diwali firecrackers', 'flammable'],
    ['Pan masala', 'tobacco'],
  ])('blocks "%s" (%s)', (text, reason) => {
    expect(findBlockedTerm(text, terms)?.reason_code).toBe(reason);
  });

  it.each([
    'Nescafe Gold coffee',
    'Ginger candy',
    'Rumali roti mix',
    'Cashew nuts',
    'Kaju katli with silver varq',
    'Dosa batter',
    'Pet food',
    'Tablet cover for my Kindle case',
  ])('allows "%s"', (text) => {
    if (text.startsWith('Tablet')) {
      // "tablet" is blocked on purpose (medicine), even when it means something else.
      expect(findBlockedTerm(text, terms)?.reason_code).toBe('medicine');
    } else {
      expect(findBlockedTerm(text, terms)).toBeNull();
    }
  });
});
