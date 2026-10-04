import type { Message } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('request_id', requestId)
    .order('id', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data;
}

export async function sendMessage(input: { requestId: string; body: string }): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ request_id: input.requestId, body: input.body })
    .select()
    .single();
  if (error) throw error;
  return data;
}
