import type { Profile, Trip, Verification } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/** Navigation only: the database checks admin rights on every read and review. */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data;
}

export async function fetchPendingVerifications(): Promise<Verification[]> {
  const { data, error } = await supabase
    .from('traveler_verifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchPendingTickets(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('ticket_status', 'pending')
    .eq('status', 'active')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchVerification(id: string): Promise<Verification | null> {
  const { data, error } = await supabase
    .from('traveler_verifications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProfiles(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error) throw error;
  return data;
}

export type ReviewInput = { id: string; approve: boolean; reason?: string };

export async function reviewVerification({ id, approve, reason }: ReviewInput) {
  const { data, error } = await supabase.rpc('review_verification', {
    verification_id: id,
    approve,
    reason,
  });
  if (error) throw error;
  return data;
}

export async function reviewTicket({ id, approve, reason }: ReviewInput) {
  const { data, error } = await supabase.rpc('review_trip_ticket', {
    trip_id: id,
    approve,
    reason,
  });
  if (error) throw error;
  return data;
}
