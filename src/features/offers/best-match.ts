import type { Offer } from '@/lib/database.types';

export type RankedOffer = { offer: Offer; rating: number | null };

/** "Best match": highest rating first, then the earliest trip, then the lowest fare. */
export function rankOffers(list: RankedOffer[]): RankedOffer[] {
  return [...list].sort(
    (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) ||
      a.offer.travel_date.localeCompare(b.offer.travel_date) ||
      a.offer.fare_paise - b.offer.fare_paise,
  );
}
