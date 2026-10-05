import type { Message } from '@/lib/database.types';
import { prepareJpeg } from '@/lib/images';
import { supabase } from '@/lib/supabase';

const PHOTO_BUCKET = 'chat-photos';

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

/** Every chat the user is in: the latest messages across their requests (RLS limits rows). */
export async function fetchRecentMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('id', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data;
}

/** The other person's phone number, shown only after payment (null before). */
export async function fetchCounterpartPhone(requestId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('counterpart_phone', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

export async function getChatPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function sendMessage(input: {
  requestId: string;
  body: string;
  userId?: string;
  photoUri?: string | null;
}): Promise<Message> {
  let photoPath: string | null = null;
  if (input.photoUri && input.userId) {
    const bytes = await prepareJpeg(input.photoUri, 1280);
    photoPath = `${input.userId}/${input.requestId}-${Date.now()}.jpg`;
    const upload = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, bytes, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({ request_id: input.requestId, body: input.body, photo_path: photoPath })
    .select()
    .single();
  if (error) throw error;
  return data;
}
