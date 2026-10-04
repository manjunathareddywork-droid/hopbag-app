import type { Rating } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type RatingSummary = { user_id: string; average: number; count: number };

export async function fetchRatingSummaries(userIds: string[]): Promise<RatingSummary[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('rating_summary', { p_user_ids: userIds });
  if (error) throw error;
  return data;
}

/** The rating this user gave on a request, if any. */
export async function fetchMyRating(requestId: string, userId: string): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('request_id', requestId)
    .eq('rater_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function rateCounterpart(input: {
  requestId: string;
  stars: number;
  comment: string;
}) {
  const { data, error } = await supabase.rpc('rate_counterpart', {
    p_request_id: input.requestId,
    p_stars: input.stars,
    p_comment: input.comment,
  });
  if (error) throw error;
  return data;
}
