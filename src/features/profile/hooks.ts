import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import {
  fetchDeletionRequest,
  fetchMyProfile,
  fetchProfilesByIds,
  fetchProfileStats,
  getAvatarUrl,
  requestAccountDeletion,
  savePreferences,
  saveProfile,
  sendSupportMessage,
} from './api';
import type { ProfileFormValues } from './schema';

export const profileKeys = {
  mine: (userId: string) => ['profile', userId] as const,
  avatar: (path: string) => ['avatar', path] as const,
  byIds: (ids: string[]) => ['profiles', ...ids] as const,
  stats: (userId: string) => ['profiles', 'stats', userId] as const,
  deletion: (userId: string) => ['profile', 'deletion', userId] as const,
};

export function useProfileStats(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.stats(userId ?? 'none'),
    queryFn: () => fetchProfileStats(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useSavePreferences() {
  const userId = useSession().session?.user.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: { push_enabled?: boolean; offer_alerts?: boolean }) =>
      savePreferences(userId, prefs),
    onSuccess: (saved) => queryClient.setQueryData(profileKeys.mine(saved.id), saved),
  });
}

export const useSendSupport = () => useMutation({ mutationFn: sendSupportMessage });

export function useDeletionRequest() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: profileKeys.deletion(userId),
    queryFn: () => fetchDeletionRequest(userId),
    enabled: !!userId,
  });
}

export function useRequestDeletion() {
  const userId = useSession().session?.user.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.deletion(userId) }),
  });
}

export function useMyProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: profileKeys.mine(userId ?? 'none'),
    queryFn: () => fetchMyProfile(userId!),
    enabled: !!userId,
  });
}

export function useProfilesByIds(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: profileKeys.byIds(sorted),
    queryFn: () => fetchProfilesByIds(sorted),
    enabled: sorted.length > 0,
  });
}

export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.avatar(path ?? 'none'),
    queryFn: () => getAvatarUrl(path!),
    enabled: !!path,
    // Signed URLs last an hour; refresh well before that.
    staleTime: 45 * 60 * 1000,
  });
}

export function useSaveProfile() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const profile = useMyProfile().data ?? null;

  return useMutation({
    mutationFn: (values: ProfileFormValues) => saveProfile(session!.user.id, values, profile),
    onSuccess: (saved, values) => {
      queryClient.setQueryData(profileKeys.mine(saved.id), saved);
      if (values.photoUri && saved.avatar_path) {
        // Same path, new file: fetch a fresh signed URL.
        queryClient.invalidateQueries({ queryKey: profileKeys.avatar(saved.avatar_path) });
      }
    },
  });
}
