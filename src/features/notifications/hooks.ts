import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

import { fetchNotifications, markAllRead } from './api';

export const notificationKeys = {
  list: (userId: string) => ['notifications', userId] as const,
};

/** The user's updates, refreshed live when a new one arrives (Realtime, RLS applies). */
export function useNotifications() {
  const userId = useSession().session?.user.id ?? '';
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.list(userId),
    queryFn: () => fetchNotifications(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
          // Something changed for this user: refresh the screens that show it.
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['offers'] });
          queryClient.invalidateQueries({ queryKey: ['delivery'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => n.read_at === null).length;
}

export function useMarkAllRead() {
  const userId = useSession().session?.user.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllRead(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
  });
}
