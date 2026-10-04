import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import { fetchMyProfile, getAvatarUrl, saveProfile } from './api';
import type { ProfileFormValues } from './schema';

export const profileKeys = {
  mine: (userId: string) => ['profile', userId] as const,
  avatar: (path: string) => ['avatar', path] as const,
};

export function useMyProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: profileKeys.mine(userId ?? 'none'),
    queryFn: () => fetchMyProfile(userId!),
    enabled: !!userId,
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
