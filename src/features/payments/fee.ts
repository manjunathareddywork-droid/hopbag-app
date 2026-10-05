/**
 * Same as public.platform_fee(fare): the Hopbag fee the requester pays on top of
 * the fare, rounded to the nearest paisa. Integer maths only.
 */
export function platformFee(farePaise: number, bps = 1000): number {
  return Math.floor((farePaise * bps + 5000) / 10000);
}

/** What the requester pays: item price + fare + fee. */
export function totalToPay(itemPricePaise: number, farePaise: number, bps?: number): number {
  return itemPricePaise + farePaise + platformFee(farePaise, bps);
}
