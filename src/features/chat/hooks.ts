import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Message } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { useSession } from '@/features/auth/session';

import {
  fetchCounterpartPhone,
  fetchMessages,
  fetchRecentMessages,
  getChatPhotoUrl,
  sendMessage,
} from './api';

export const chatKeys = {
  messages: (requestId: string) => ['chat', requestId] as const,
  recent: (userId: string) => ['chat', 'recent', userId] as const,
  phone: (requestId: string) => ['chat', 'phone', requestId] as const,
  photo: (path: string) => ['chat', 'photo', path] as const,
};

export function useRecentMessages() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: chatKeys.recent(userId),
    queryFn: fetchRecentMessages,
    enabled: !!userId,
  });
}

export function useCounterpartPhone(requestId: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.phone(requestId),
    queryFn: () => fetchCounterpartPhone(requestId),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useChatPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: chatKeys.photo(path ?? 'none'),
    queryFn: () => getChatPhotoUrl(path!),
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
  });
}

/** Adds a message once, keeping order by id (Realtime and the send response can both deliver it). */
export function mergeMessage(list: Message[] | undefined, message: Message): Message[] {
  const current = list ?? [];
  if (current.some((m) => m.id === message.id)) return current;
  return [...current, message].sort((a, b) => a.id - b.id);
}

/** Messages for a request, kept live with Supabase Realtime (RLS applies). */
export function useChat(requestId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chatKeys.messages(requestId),
    queryFn: () => fetchMessages(requestId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          queryClient.setQueryData<Message[]>(chatKeys.messages(requestId), (list) =>
            mergeMessage(list, payload.new as Message),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, requestId]);

  return query;
}

export function useSendMessage(requestId: string) {
  const queryClient = useQueryClient();
  const userId = useSession().session?.user.id;
  return useMutation({
    mutationFn: (input: string | { body: string; photoUri?: string | null }) =>
      typeof input === 'string'
        ? sendMessage({ requestId, body: input })
        : sendMessage({ requestId, userId, ...input }),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(requestId), (list) =>
        mergeMessage(list, message),
      );
      queryClient.invalidateQueries({ queryKey: ['chat', 'recent'] });
    },
  });
}
