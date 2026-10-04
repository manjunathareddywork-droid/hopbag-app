import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import { fetchMyRating, fetchRatingSummaries, rateCounterpart } from './api';

export const ratingKeys = {
  summaries: (ids: string[]) => ['ratings', 'summary', ...ids] as const,
  mine: (requestId: string) => ['ratings', 'mine', requestId] as const,
};

export function useRatingSummaries(userIds: string[]) {
  const sorted = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ratingKeys.summaries(sorted),
    queryFn: () => fetchRatingSummaries(sorted),
    enabled: sorted.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyRating(requestId: string) {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: ratingKeys.mine(requestId),
    queryFn: () => fetchMyRating(requestId, userId),
    enabled: !!userId,
  });
}

export function useRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rateCounterpart,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ratings'] }),
  });
}
