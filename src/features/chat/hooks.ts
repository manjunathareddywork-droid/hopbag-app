import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Message } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { fetchMessages, sendMessage } from './api';

export const chatKeys = {
  messages: (requestId: string) => ['chat', requestId] as const,
};

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
  return useMutation({
    mutationFn: (body: string) => sendMessage({ requestId, body }),
    onSuccess: (message) =>
      queryClient.setQueryData<Message[]>(chatKeys.messages(requestId), (list) =>
        mergeMessage(list, message),
      ),
  });
}
