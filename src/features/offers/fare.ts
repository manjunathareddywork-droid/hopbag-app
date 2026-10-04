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
    minPaise: Math.max(floor, perKg(settings.fare_min_per_kg_paise ?? 10000)),
    maxPaise: Math.max(floor, perKg(settings.fare_max_per_kg_paise ?? 50000)),
  };
}
