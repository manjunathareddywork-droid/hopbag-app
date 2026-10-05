import { rankOffers } from '@/features/offers/best-match';
import { platformFee, totalToPay } from '@/features/payments/fee';
import { firstName, shortName } from '@/features/profile/name';
import { clampFare } from '@/features/offers/fare';
import { gramsToKg } from '@/features/requests/weight';
import type { Offer } from '@/lib/database.types';
import { formatAgo, formatDay, formatShortDate, formatWhen } from '@/lib/dates';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('platformFee (same as public.platform_fee)', () => {
  it('is 10% of the fare, rounded to the nearest paisa', () => {
    expect(platformFee(20000)).toBe(2000);
    expect(platformFee(18000)).toBe(1800);
    expect(platformFee(15005)).toBe(1501);
    expect(platformFee(15004)).toBe(1500);
    expect(platformFee(0)).toBe(0);
  });

  it('the requester pays item + fare + fee (Rs 320 + Rs 180 + Rs 18 = Rs 518)', () => {
    expect(totalToPay(32000, 18000)).toBe(51800);
  });
});

describe('rankOffers (best match)', () => {
  const offer = (id: string, travel_date: string, fare_paise: number) =>
    ({ id, travel_date, fare_paise }) as Offer;

  it('puts the best rated first, then the earliest trip, then the lowest fare', () => {
    const ranked = rankOffers([
      { offer: offer('new', '2026-10-09', 15000), rating: null },
      { offer: offer('good-late', '2026-10-12', 18000), rating: 4.9 },
      { offer: offer('good-early', '2026-10-10', 22000), rating: 4.9 },
      { offer: offer('good-early-cheap', '2026-10-10', 20000), rating: 4.9 },
      { offer: offer('ok', '2026-10-09', 15000), rating: 4.2 },
    ]);
    expect(ranked.map((r) => r.offer.id)).toEqual([
      'good-early-cheap',
      'good-early',
      'good-late',
      'ok',
      'new',
    ]);
  });
});

describe('names', () => {
  it('shortName matches public.display_name', () => {
    expect(shortName('Sneha Iyer')).toBe('Sneha I.');
    expect(shortName('  Arjun  Kumar Mehta ')).toBe('Arjun M.');
    expect(shortName('Rahul')).toBe('Rahul');
    expect(shortName(null)).toBe('');
  });

  it('firstName', () => {
    expect(firstName('Sneha Iyer')).toBe('Sneha');
    expect(firstName(undefined)).toBe('');
  });
});

describe('fare slider and trip space', () => {
  it('keeps the fare inside the band', () => {
    expect(clampFare(40, 50, 250)).toBe(50);
    expect(clampFare(300, 50, 250)).toBe(250);
    expect(clampFare(120, 50, 250)).toBe(120);
    expect(clampFare(Number.NaN, 50, 250)).toBe(50);
  });

  it('shows grams as kilograms without float noise', () => {
    expect(gramsToKg(500)).toBe('0.5');
    expect(gramsToKg(4500)).toBe('4.5');
    expect(gramsToKg(5000)).toBe('5');
    expect(gramsToKg(1250)).toBe('1.25');
  });
});

describe('design date formats', () => {
  it('formatDay and formatShortDate', () => {
    expect(formatDay('2026-10-09')).toBe('Fri 9 Oct');
    expect(formatShortDate('2026-10-14')).toBe('14 Oct');
  });

  it('formatWhen: time today, Yesterday, weekday, then date', () => {
    const now = new Date(2026, 9, 9, 18, 0);
    expect(formatWhen(new Date(2026, 9, 9, 14, 14).toISOString(), now)).toBe('2:14 pm');
    expect(formatWhen(new Date(2026, 9, 8, 9, 0).toISOString(), now)).toBe('Yesterday');
    expect(formatWhen(new Date(2026, 9, 5, 9, 0).toISOString(), now)).toBe('Mon');
    expect(formatWhen(new Date(2026, 8, 20, 9, 0).toISOString(), now)).toBe('20 Sep');
  });

  it('formatAgo', () => {
    const now = new Date(2026, 9, 9, 18, 0);
    expect(formatAgo(new Date(2026, 9, 9, 17, 48).toISOString(), now)).toBe('12 min ago');
    expect(formatAgo(new Date(2026, 9, 9, 17, 0).toISOString(), now)).toBe('1 hour ago');
    expect(formatAgo(new Date(2026, 9, 8, 9, 0).toISOString(), now)).toBe('Yesterday');
  });
});
