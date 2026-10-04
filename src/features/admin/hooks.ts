import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { profileKeys } from '@/features/profile/hooks';

import {
  fetchIsAdmin,
  fetchPendingTickets,
  fetchPendingVerifications,
  fetchProfiles,
  fetchVerification,
  reviewTicket,
  reviewVerification,
} from './api';

export const adminKeys = {
  isAdmin: (userId: string) => ['is-admin', userId] as const,
  pendingIds: ['admin', 'pending-ids'] as const,
  pendingTickets: ['admin', 'pending-tickets'] as const,
  verification: (id: string) => ['admin', 'verification', id] as const,
  profiles: (ids: string[]) => ['admin', 'profiles', ...ids] as const,
};

export function useIsAdmin() {
  const userId = useSession().session?.user.id;
  return useQuery({
    queryKey: adminKeys.isAdmin(userId ?? 'none'),
    queryFn: fetchIsAdmin,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePendingVerifications() {
  return useQuery({ queryKey: adminKeys.pendingIds, queryFn: fetchPendingVerifications });
}

export function usePendingTickets() {
  return useQuery({ queryKey: adminKeys.pendingTickets, queryFn: fetchPendingTickets });
}

export function useVerification(id: string) {
  return useQuery({ queryKey: adminKeys.verification(id), queryFn: () => fetchVerification(id) });
}

/** Names for the people in a review list. */
export function useProfiles(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: adminKeys.profiles(sorted),
    queryFn: () => fetchProfiles(sorted),
    enabled: sorted.length > 0,
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewVerification,
    onSuccess: (reviewed) => {
      queryClient.setQueryData(adminKeys.verification(reviewed.id), reviewed);
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingIds });
      // The reviewer may have approved themselves: refresh the badge.
      queryClient.invalidateQueries({ queryKey: profileKeys.mine(reviewed.user_id) });
    },
  });
}

export function useReviewTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingTickets });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
