import { useMyOffers, useRequestsByIds } from '@/features/offers/hooks';

export type TripLoad = { items: number; grams: number };

/** Same as public.trip_load(): accepted offers on each of my trips, and their weight. */
export function useTripLoads(): Record<string, TripLoad> {
  const offers = useMyOffers().data ?? [];
  const accepted = offers.filter((o) => o.status === 'accepted');
  const requests = useRequestsByIds(accepted.map((o) => o.request_id)).data ?? [];
  const loads: Record<string, TripLoad> = {};
  for (const o of accepted) {
    const grams = requests.find((r) => r.id === o.request_id)?.weight_grams ?? 0;
    const load = loads[o.trip_id] ?? { items: 0, grams: 0 };
    loads[o.trip_id] = { items: load.items + 1, grams: load.grams + grams };
  }
  return loads;
}
