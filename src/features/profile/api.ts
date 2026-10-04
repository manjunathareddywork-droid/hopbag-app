import type { Profile } from '@/lib/database.types';
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
  };

  const query = existing
    ? supabase.from('profiles').update(fields).eq('id', userId)
    : supabase.from('profiles').insert({ id: userId, ...fields });

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
