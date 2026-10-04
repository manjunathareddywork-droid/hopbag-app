import { fareBand } from '@/features/offers/fare';
import { validateFare } from '@/features/offers/offer-form';

const settings = {
  fare_min_per_kg_paise: 10000,
  fare_max_per_kg_paise: 50000,
  fare_floor_paise: 5000,
};

describe('fareBand (same values as the database tests)', () => {
  it('1 kg -> Rs 100 to Rs 500', () => {
    expect(fareBand(1000, settings)).toEqual({ minPaise: 10000, maxPaise: 50000 });
  });

  it('small items use the Rs 50 floor', () => {
    expect(fareBand(200, settings)).toEqual({ minPaise: 5000, maxPaise: 10000 });
  });

  it('rounds up to the paisa', () => {
    expect(fareBand(1234, settings)).toEqual({ minPaise: 12340, maxPaise: 61700 });
    expect(fareBand(1, { ...settings, fare_floor_paise: 0 })).toEqual({
      minPaise: 10,
      maxPaise: 50,
    });
  });
});

describe('validateFare', () => {
  it('accepts a fare inside the band', () => {
    expect(validateFare('250', 10000, 50000)).toBeNull();
    expect(validateFare('100', 10000, 50000)).toBeNull();
    expect(validateFare('500', 10000, 50000)).toBeNull();
  });

  it('rejects fares outside the band with the band in the message', () => {
    expect(validateFare('99', 10000, 50000)).toBe('Choose a fare between ₹100 and ₹500.');
    expect(validateFare('501', 10000, 50000)).toBe('Choose a fare between ₹100 and ₹500.');
  });

  it('rejects text that is not a whole rupee amount', () => {
    expect(validateFare('two hundred', 10000, 50000)).toBe(
      'Enter an amount in rupees, for example 250',
    );
  });
});
