import type { City, State } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function fetchStates(): Promise<State[]> {
  const { data, error } = await supabase.from('states').select('code, name').order('name');
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
