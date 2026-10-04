import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import {
  confirmDeliveryCode,
  confirmReceived,
  fetchDelivery,
  fetchDispute,
  fetchMyPayouts,
  fetchOpenDisputes,
  getPickupPhotoUrl,
  issueHandoverCode,
  markHandedOver,
  markPickedUp,
  raiseDispute,
  resolveRefund,
  resolveRelease,
} from './api';

export const deliveryKeys = {
  delivery: (requestId: string) => ['delivery', requestId] as const,
  dispute: (requestId: string) => ['delivery', 'dispute', requestId] as const,
  openDisputes: ['delivery', 'open-disputes'] as const,
  payouts: (userId: string) => ['delivery', 'payouts', userId] as const,
  photo: (path: string) => ['delivery', 'photo', path] as const,
};

export function useDelivery(requestId: string) {
  return useQuery({
    queryKey: deliveryKeys.delivery(requestId),
    queryFn: () => fetchDelivery(requestId),
  });
}

export function useDispute(requestId: string) {
  return useQuery({
    queryKey: deliveryKeys.dispute(requestId),
    queryFn: () => fetchDispute(requestId),
  });
}

export function useOpenDisputes() {
  return useQuery({ queryKey: deliveryKeys.openDisputes, queryFn: fetchOpenDisputes });
}

export function useMyPayouts() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: deliveryKeys.payouts(userId),
    queryFn: () => fetchMyPayouts(userId),
    enabled: !!userId,
  });
}

export function usePickupPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: deliveryKeys.photo(path ?? 'none'),
    queryFn: () => getPickupPhotoUrl(path!),
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
  });
}

/** Every delivery step changes the request, payment and payouts too. */
function useDeliveryMutation<T, R>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

export function useMarkPickedUp() {
  const userId = useSession().session?.user.id ?? '';
  return useDeliveryMutation(
    (input: { requestId: string; photoUri: string; weightGrams: number }) =>
      markPickedUp({ userId, ...input }),
  );
}

/** Not cached: each tap shows a fresh code. */
export const useIssueHandoverCode = () => useMutation({ mutationFn: issueHandoverCode });
export const useConfirmDeliveryCode = () => useDeliveryMutation(confirmDeliveryCode);
export const useMarkHandedOver = () => useDeliveryMutation(markHandedOver);
export const useConfirmReceived = () => useDeliveryMutation(confirmReceived);
export const useRaiseDispute = () => useDeliveryMutation(raiseDispute);
export const useResolveRelease = () => useDeliveryMutation(resolveRelease);
export const useResolveRefund = () => useDeliveryMutation(resolveRefund);
