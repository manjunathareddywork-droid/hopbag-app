import type { ReportCategory, UserReport } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function fetchMyBlocks(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return data.map((row) => row.blocked_id);
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').insert({ blocked_id: userId });
  // Already blocked is fine.
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId);
  if (error) throw error;
}

export async function reportUser(input: {
  reportedUserId: string;
  requestId?: string | null;
  category: ReportCategory;
  details: string;
}): Promise<void> {
  const { error } = await supabase.from('user_reports').insert({
    reported_user_id: input.reportedUserId,
    request_id: input.requestId ?? null,
    category: input.category,
    details: input.details,
  });
  if (error) throw error;
}

/** A suspension row is readable only by that person and by admins. */
export async function fetchSuspension(userId: string) {
  const { data, error } = await supabase
    .from('account_suspensions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Admin

export async function fetchOpenReports(): Promise<UserReport[]> {
  const { data, error } = await supabase
    .from('user_reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchReport(id: string): Promise<UserReport | null> {
  const { data, error } = await supabase
    .from('user_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function reviewReport(input: { id: string; note: string; suspend: boolean }) {
  const { error } = await supabase.rpc('review_report', {
    p_report_id: input.id,
    p_note: input.note,
    p_suspend: input.suspend,
  });
  if (error) throw error;
}

export async function setSuspension(input: {
  userId: string;
  suspended: boolean;
  reason?: string;
}) {
  const { error } = await supabase.rpc('set_suspension', {
    p_user_id: input.userId,
    p_suspended: input.suspended,
    p_reason: input.reason,
  });
  if (error) throw error;
}

export async function fetchDashboard() {
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) throw error;
  return data;
}

export async function fetchFunnel(days = 30) {
  const { data, error } = await supabase.rpc('admin_funnel', { p_days: days });
  if (error) throw error;
  return data;
}

export async function fetchErrorGroups(hours = 24) {
  const { data, error } = await supabase.rpc('admin_error_groups', { p_hours: hours });
  if (error) throw error;
  return data;
}
