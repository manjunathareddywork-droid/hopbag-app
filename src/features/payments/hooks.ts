import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import { fetchHeldForTraveler, fetchPaymentForRequest, refundPayment, verifyPayment } from './api';

export const paymentKeys = {
  forRequest: (requestId: string) => ['payments', 'request', requestId] as const,
  held: (userId: string) => ['payments', 'held', userId] as const,
};

export function usePaymentForRequest(requestId: string) {
  return useQuery({
    queryKey: paymentKeys.forRequest(requestId),
    queryFn: () => fetchPaymentForRequest(requestId),
  });
}

export function useHeldForMe() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: paymentKeys.held(userId),
    queryFn: () => fetchHeldForTraveler(userId),
    enabled: !!userId,
  });
}

/** Payment and refund change the request, offers and trip space too. */
function useRefreshAfter<T, R>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

export const useVerifyPayment = () => useRefreshAfter(verifyPayment);
export const useRefundPayment = () => useRefreshAfter(refundPayment);
