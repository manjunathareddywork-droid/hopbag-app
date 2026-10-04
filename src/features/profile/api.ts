import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Profile, State } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import type { ProfileFormValues } from './schema';

const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 512;

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchStates(): Promise<State[]> {
  const { data, error } = await supabase.from('states').select('code, name').order('name');
  if (error) throw error;
  return data;
}

/** Shrinks the photo (saves data on slow connections) and uploads it to <uid>/avatar.jpg. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(localUri)
    .resize({ width: AVATAR_SIZE })
    .renderAsync();
  const image = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const body = await fetch(image.uri).then((res) => res.arrayBuffer());

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
    home_state: values.homeState,
    home_city: values.homeCity,
    avatar_path: avatarPath,
  };

  const query = existing
    ? supabase.from('profiles').update(fields).eq('id', userId)
    : supabase.from('profiles').insert({ id: userId, ...fields });

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
