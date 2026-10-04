import { makeRequestSchema, type RequestFormValues } from '@/features/requests/schema';
import type { BlockedTerm, Category, City } from '@/lib/database.types';

const categories = [
  { id: 'coffee_tea', max_weight_grams: 3000 },
  { id: 'cosmetics', max_weight_grams: 1000 },
] as Category[];
const cities = [
  { id: 1, name: 'Hyderabad', state_code: 'TS' },
  { id: 2, name: 'Bengaluru', state_code: 'KA' },
  { id: 3, name: 'Mysuru', state_code: 'KA' },
] as City[];
const blockedTerms: BlockedTerm[] = [{ id: 1, pattern: 'whiske?y', reason_code: 'alcohol' }];

const schema = makeRequestSchema({ categories, cities, blockedTerms, today: '2026-10-04' });

const valid: RequestFormValues = {
  categoryId: 'coffee_tea',
  itemName: 'Filter coffee powder',
  details: '',
  weightKg: '1',
  fromCityId: '1',
  toCityId: '2',
  deadline: '2026-10-11',
  budgetRupees: '500',
  itemPriceRupees: '400',
  photoUri: null,
};

function firstError(override: Partial<RequestFormValues>) {
  const result = schema.safeParse({ ...valid, ...override });
  return result.success ? null : result.error.issues[0].message;
}

describe('request form rules', () => {
  it('accepts a valid request', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each<[Partial<RequestFormValues>, string]>([
    [{ categoryId: '' }, 'requests.errors.categoryRequired'],
    [{ itemName: 'x' }, 'requests.errors.itemNameShort'],
    [{ itemName: 'Johnnie Walker whisky' }, 'blocked:alcohol'],
    [{ details: 'and one whiskey' }, 'blocked:alcohol'],
    [{ weightKg: 'abc' }, 'requests.errors.weightInvalid'],
    [{ categoryId: 'cosmetics', weightKg: '1.5' }, 'tooHeavy:1000'],
    [{ fromCityId: '' }, 'requests.errors.cityRequired'],
    [{ toCityId: '1' }, 'requests.errors.sameCity'],
    [{ fromCityId: '3' }, 'requests.errors.sameState'],
    [{ deadline: '' }, 'requests.errors.deadlineRequired'],
    [{ deadline: '2026-10-04' }, 'requests.errors.deadlineRange'],
    [{ deadline: '2026-10-25' }, 'requests.errors.deadlineRange'],
    [{ budgetRupees: '12.50' }, 'requests.errors.budgetInvalid'],
    [{ budgetRupees: '49' }, 'requests.errors.budgetRange'],
    [{ budgetRupees: '10001' }, 'requests.errors.budgetRange'],
    [{ itemPriceRupees: '' }, 'requests.errors.itemPriceInvalid'],
    [{ itemPriceRupees: '399.50' }, 'requests.errors.itemPriceInvalid'],
    [{ itemPriceRupees: '0' }, 'requests.errors.itemPriceRange'],
    [{ itemPriceRupees: '10001' }, 'requests.errors.itemPriceRange'],
  ])('rejects %j with %s', (override, message) => {
    expect(firstError(override)).toBe(message);
  });

  it('allows the last day of the 20-day window', () => {
    expect(firstError({ deadline: '2026-10-24' })).toBeNull();
  });
});
