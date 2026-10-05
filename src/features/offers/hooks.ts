import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { track, type EventName } from '@/lib/monitoring';

import {
  acceptOffer,
  declineOffer,
  fetchFeed,
  fetchMyOffers,
  fetchOffersForRequest,
  fetchOffersForRequests,
  fetchRequestsByIds,
  makeOffer,
  withdrawOffer,
} from './api';

export const offerKeys = {
  feed: (tripId: string) => ['feed', tripId] as const,
  forRequest: (requestId: string) => ['offers', 'request', requestId] as const,
  mine: (userId: string) => ['offers', 'mine', userId] as const,
  requests: (ids: string[]) => ['offers', 'requests', ...ids] as const,
};

export function useFeed(tripId: string | undefined) {
  return useQuery({
    queryKey: offerKeys.feed(tripId ?? 'none'),
    queryFn: () => fetchFeed(tripId!),
    enabled: !!tripId,
  });
}

export function useOffersForRequest(requestId: string) {
  return useQuery({
    queryKey: offerKeys.forRequest(requestId),
    queryFn: () => fetchOffersForRequest(requestId),
  });
}

export function useOffersForRequests(requestIds: string[]) {
  const sorted = [...new Set(requestIds)].sort();
  return useQuery({
    queryKey: ['offers', 'requests-list', ...sorted],
    queryFn: () => fetchOffersForRequests(sorted),
    enabled: sorted.length > 0,
  });
}

export function useMyOffers() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: offerKeys.mine(userId),
    queryFn: () => fetchMyOffers(userId),
    enabled: !!userId,
  });
}

export function useRequestsByIds(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: offerKeys.requests(sorted),
    queryFn: () => fetchRequestsByIds(sorted),
    enabled: sorted.length > 0,
  });
}

/** Any offer change can move request status, feeds and trip space: refresh them all. */
function useOfferMutation<T>(fn: (input: T) => Promise<unknown>, event?: EventName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (event) track(event);
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export const useMakeOffer = () => useOfferMutation(makeOffer, 'offer_sent');
export const useWithdrawOffer = () => useOfferMutation(withdrawOffer);
export const useAcceptOffer = () => useOfferMutation(acceptOffer, 'offer_accepted');
export const useDeclineOffer = () => useOfferMutation(declineOffer);
