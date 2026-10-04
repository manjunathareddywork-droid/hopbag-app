import type { BlockedTerm, Category, City, ItemRequest } from '@/lib/database.types';
import { prepareJpeg } from '@/lib/images';
import { rupeesToPaise } from '@/lib/money';
import { supabase } from '@/lib/supabase';

import type { RequestFormValues } from './schema';
import { kgToGrams } from './weight';

const PHOTO_BUCKET = 'request-photos';
const PHOTO_WIDTH = 1024;

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('allowed_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchBlockedTerms(): Promise<BlockedTerm[]> {
  const { data, error } = await supabase.from('blocked_terms').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function fetchMyRequests(): Promise<ItemRequest[]> {
  // RLS returns only the signed-in user's requests.
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchRequest(id: string): Promise<ItemRequest | null> {
  const { data, error } = await supabase
    .from('item_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function uploadRequestPhoto(userId: string, localUri: string): Promise<string> {
  const body = await prepareJpeg(localUri, PHOTO_WIDTH);
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function getRequestPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Values must already be validated by makeRequestSchema. The database re-checks every rule. */
export async function createRequest(
  userId: string,
  values: RequestFormValues,
): Promise<ItemRequest> {
  const photoPath = values.photoUri ? await uploadRequestPhoto(userId, values.photoUri) : null;

  const { data, error } = await supabase
    .from('item_requests')
    .insert({
      category_id: values.categoryId,
      item_name: values.itemName,
      details: values.details,
      weight_grams: kgToGrams(values.weightKg)!,
      from_city_id: Number(values.fromCityId),
      to_city_id: Number(values.toCityId),
      deadline: values.deadline,
      budget_paise: rupeesToPaise(values.budgetRupees)!,
      photo_path: photoPath,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelRequest(id: string): Promise<ItemRequest> {
  const { data, error } = await supabase.rpc('cancel_request', { request_id: id });
  if (error) throw error;
  return data;
}
