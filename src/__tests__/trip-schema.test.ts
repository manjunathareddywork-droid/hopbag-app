import {
  limitsFromSettings,
  makeTripSchema,
  normalizePnr,
  verificationSchema,
  type TripFormInput,
} from '@/features/travelers/schema';
import type { City } from '@/lib/database.types';

const cities = [
  { id: 1, name: 'Bengaluru', state_code: 'KA' },
  { id: 2, name: 'Mysuru', state_code: 'KA' },
  { id: 3, name: 'Hyderabad', state_code: 'TS' },
] as City[];
const limits = limitsFromSettings({
  trip_max_items: 3,
  trip_max_grams: 5000,
  trip_max_days_ahead: 60,
});
const schema = makeTripSchema(cities, limits, '2026-10-04');

const valid: TripFormInput = {
  fromCityId: '1',
  toCityId: '3',
  travelDate: '2026-10-04',
  mode: 'train',
  capacityKg: '3',
  maxItems: '2',
  pnr: '452 136 7890',
  ticketUri: 'file:///ticket.jpg',
};

function firstError(override: Partial<Record<keyof TripFormInput, unknown>>) {
  const result = schema.safeParse({ ...valid, ...override });
  return result.success ? null : result.error.issues[0].message;
}

describe('trip form rules', () => {
  it('accepts a trip today and cleans up the PNR', () => {
    const result = schema.parse(valid);
    expect(result.pnr).toBe('4521367890');
  });

  it.each<[Partial<Record<keyof TripFormInput, unknown>>, string]>([
    [{ fromCityId: '' }, 'trips.errors.cityRequired'],
    [{ toCityId: '1' }, 'trips.errors.sameCity'],
    [{ fromCityId: '2', toCityId: '1' }, 'trips.errors.sameState'],
    [{ travelDate: '' }, 'trips.errors.dateRequired'],
    [{ travelDate: '2026-10-03' }, 'trips.errors.dateRange'],
    [{ travelDate: '2026-12-04' }, 'trips.errors.dateRange'],
    [{ mode: undefined }, 'trips.errors.modeRequired'],
    [{ mode: 'rocket' }, 'trips.errors.modeRequired'],
    [{ capacityKg: 'lots' }, 'trips.errors.capacityInvalid'],
    [{ capacityKg: '5.5' }, 'trips.errors.overLimit'],
    [{ maxItems: '0' }, 'trips.errors.maxItemsInvalid'],
    [{ maxItems: '4' }, 'trips.errors.overLimit'],
    [{ pnr: 'AB1' }, 'trips.errors.pnrInvalid'],
    [{ pnr: 'PNR#12345' }, 'trips.errors.pnrInvalid'],
    [{ ticketUri: undefined }, 'trips.errors.ticketRequired'],
  ])('rejects %j with %s', (override, message) => {
    expect(firstError(override)).toBe(message);
  });

  it('allows the last day of the window', () => {
    expect(firstError({ travelDate: '2026-12-03' })).toBeNull();
  });

  it('follows changed limits from settings', () => {
    const roomy = makeTripSchema(
      cities,
      limitsFromSettings({ trip_max_items: 5, trip_max_grams: 5000, trip_max_days_ahead: 60 }),
      '2026-10-04',
    );
    expect(roomy.safeParse({ ...valid, maxItems: '5' }).success).toBe(true);
  });
});

describe('normalizePnr', () => {
  it('removes spaces and dashes and uppercases', () => {
    expect(normalizePnr(' ab-12 cd ')).toBe('AB12CD');
  });
});

describe('verificationSchema', () => {
  it('needs an ID type and a photo', () => {
    const result = verificationSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'verifyId.idTypeRequired',
      'verifyId.photoRequired',
    ]);
  });

  it('accepts a complete submission', () => {
    expect(
      verificationSchema.safeParse({ idType: 'aadhaar', photoUri: 'file:///id.jpg' }).success,
    ).toBe(true);
  });
});
