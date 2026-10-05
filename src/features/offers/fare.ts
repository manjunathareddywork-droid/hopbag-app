import { t } from '@/i18n';
import { formatPaise, rupeesToPaise } from '@/lib/money';

/**
 * Same as public.fare_band(weight_grams): per-kg band, rounded up to the paisa,
 * never below the floor. Integer maths only.
 */
export type FareSettings = {
  fare_min_per_kg_paise?: number;
  fare_max_per_kg_paise?: number;
  fare_floor_paise?: number;
};

export function fareBand(weightGrams: number, settings: FareSettings) {
  const floor = settings.fare_floor_paise ?? 5000;
  const perKg = (paise: number) => Math.ceil((weightGrams * paise) / 1000);
  return {
    minPaise: Math.max(floor, perKg(settings.fare_min_per_kg_paise ?? 5000)),
    maxPaise: Math.max(floor, perKg(settings.fare_max_per_kg_paise ?? 50000)),
  };
}

/** Checks a typed fare against the band before sending; the database checks it again. */
export function validateFare(input: string, minPaise: number, maxPaise: number): string | null {
  const paise = rupeesToPaise(input);
  if (paise === null) return t('offers.fareInvalid');
  if (paise < minPaise || paise > maxPaise) {
    return t('offers.fareOutOfBand', { min: formatPaise(minPaise), max: formatPaise(maxPaise) });
  }
  return null;
}

/** A fare (whole rupees) kept inside the band, for the fare slider. */
export function clampFare(rupees: number, minRupees: number, maxRupees: number): number {
  if (!Number.isFinite(rupees)) return minRupees;
  return Math.min(maxRupees, Math.max(minRupees, rupees));
}
