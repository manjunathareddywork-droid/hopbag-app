import type { Profile, ProfileStats } from '@/lib/database.types';
import { prepareJpeg } from '@/lib/images';
import { supabase } from '@/lib/supabase';

import type { ProfileFormValues } from './schema';

const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 512;

/** Public profile fields of other people (name, city, photo, verified badge). */
export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error) throw error;
  return data;
}

/** Rating, deliveries, requests, disputes and join date for a profile card. */
export async function fetchProfileStats(userId: string): Promise<ProfileStats | null> {
  const { data, error } = await supabase.rpc('profile_stats', { p_user_id: userId });
  if (error) throw error;
  return data[0] ?? null;
}

/** Notification preferences (Settings). */
export async function savePreferences(
  userId: string,
  prefs: { push_enabled?: boolean; offer_alerts?: boolean },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(prefs)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendSupportMessage(body: string): Promise<void> {
  const { error } = await supabase.from('support_messages').insert({ body });
  if (error) throw error;
}

export async function fetchDeletionRequest(userId: string) {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestAccountDeletion(): Promise<void> {
  const { error } = await supabase.from('account_deletion_requests').insert({});
  // Asking twice is fine.
  if (error && error.code !== '23505') throw error;
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Shrinks the photo (saves data on slow connections) and uploads it to <uid>/avatar.jpg. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const body = await prepareJpeg(localUri, AVATAR_SIZE);
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function getAvatarUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Creates the profile on first save, updates it afterwards. */
export async function saveProfile(
  userId: string,
  values: ProfileFormValues,
  existing: Profile | null,
): Promise<Profile> {
  const avatarPath = values.photoUri
    ? await uploadAvatar(userId, values.photoUri)
    : (existing?.avatar_path ?? null);

  const fields = {
    full_name: values.fullName,
    home_city_id: Number(values.homeCityId),
    avatar_path: avatarPath,
    intent: values.intent,
  };

  const query = existing
    ? supabase.from('profiles').update(fields).eq('id', userId)
    : supabase.from('profiles').insert({ id: userId, ...fields });

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
