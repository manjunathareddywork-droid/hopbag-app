import type { AppNotification } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

/** Opening a chat reads its message notifications. */
export async function markChatRead(userId: string, requestId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('request_id', requestId)
    .eq('kind', 'message')
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
