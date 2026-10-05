import type { FeedRequest, ItemRequest, Offer } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/** Open requests on this trip's route, exact city matches first. */
export async function fetchFeed(tripId: string): Promise<FeedRequest[]> {
  const { data, error } = await supabase.rpc('request_feed', { p_trip_id: tripId });
  if (error) throw error;
  return data;
}

/** Offers on one request (requester view) or the traveler's own offers on it. */
export async function fetchOffersForRequest(requestId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Offers on several of the requester's requests at once (for the requests list). */
export async function fetchOffersForRequests(requestIds: string[]): Promise<Offer[]> {
  if (requestIds.length === 0) return [];
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .in('request_id', requestIds)
    .in('status', ['pending', 'accepted']);
  if (error) throw error;
  return data;
}

export async function fetchMyOffers(userId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('traveler_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Requests the traveler has offered on (RLS lets them read these). */
export async function fetchRequestsByIds(ids: string[]): Promise<ItemRequest[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('item_requests').select('*').in('id', ids);
  if (error) throw error;
  return data;
}

export type MakeOfferInput = {
  requestId: string;
  tripId: string;
  farePaise: number;
  message: string;
};

export async function makeOffer({ requestId, tripId, farePaise, message }: MakeOfferInput) {
  const { data, error } = await supabase.rpc('make_offer', {
    p_request_id: requestId,
    p_trip_id: tripId,
    p_fare_paise: farePaise,
    p_message: message,
  });
  if (error) throw error;
  return data;
}

async function offerAction(
  fn: 'withdraw_offer' | 'accept_offer' | 'decline_offer',
  offerId: string,
): Promise<Offer> {
  const { data, error } = await supabase.rpc(fn, { p_offer_id: offerId });
  if (error) throw error;
  return data;
}

export const withdrawOffer = (offerId: string) => offerAction('withdraw_offer', offerId);
export const acceptOffer = (offerId: string) => offerAction('accept_offer', offerId);
export const declineOffer = (offerId: string) => offerAction('decline_offer', offerId);
