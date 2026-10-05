import type { Delivery, Dispute, DisputeCategory, Payout } from '@/lib/database.types';
import { callFunction } from '@/lib/functions';
import { prepareJpeg } from '@/lib/images';
import { supabase } from '@/lib/supabase';

const PHOTO_BUCKET = 'handover-photos';

export async function fetchDelivery(requestId: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Latest dispute on a request (open or resolved), if any. */
export async function fetchDispute(requestId: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchOpenDisputes(): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('status', 'open')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchMyPayouts(userId: string): Promise<Payout[]> {
  const { data, error } = await supabase.from('payouts').select('*').eq('traveler_id', userId);
  if (error) throw error;
  return data;
}

export async function getPickupPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function markPickedUp(input: {
  userId: string;
  requestId: string;
  photoUri: string;
  weightGrams: number;
}): Promise<Delivery> {
  const body = await prepareJpeg(input.photoUri, 1280);
  const path = `${input.userId}/pickup-${Date.now()}.jpg`;
  const upload = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase.rpc('mark_picked_up', {
    p_request_id: input.requestId,
    p_photo_path: path,
    p_weight_grams: input.weightGrams,
  });
  if (error) throw error;
  return data;
}

/** A fresh one-time code; any code shown earlier stops working. */
export async function issueHandoverCode(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('issue_handover_code', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

export async function confirmDeliveryCode(input: { requestId: string; code: string }) {
  const { data, error } = await supabase.rpc('confirm_delivery_code', {
    p_request_id: input.requestId,
    p_code: input.code,
  });
  if (error) throw error;
  return data;
}

export async function markHandedOver(requestId: string) {
  const { error } = await supabase.rpc('mark_handed_over', { p_request_id: requestId });
  if (error) throw error;
}

export async function confirmReceived(requestId: string) {
  const { error } = await supabase.rpc('confirm_received', { p_request_id: requestId });
  if (error) throw error;
}

export async function raiseDispute(input: {
  requestId: string;
  reason: string;
  category?: DisputeCategory;
  userId?: string;
  photoUris?: string[];
}) {
  const photoPaths: string[] = [];
  for (const [i, uri] of (input.photoUris ?? []).entries()) {
    const bytes = await prepareJpeg(uri, 1280);
    const path = `${input.userId}/${input.requestId}-${Date.now()}-${i}.jpg`;
    const upload = await supabase.storage
      .from('dispute-photos')
      .upload(path, bytes, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;
    photoPaths.push(path);
  }
  const { error } = await supabase.rpc('raise_dispute', {
    p_request_id: input.requestId,
    p_reason: input.reason,
    p_category: input.category ?? 'other',
    p_photo_paths: photoPaths,
  });
  if (error) throw error;
}

/** Traveler refuses the item at pickup; the requester is refunded in full (Edge Function). */
export const declinePickup = (input: { requestId: string; reason: string }) =>
  callFunction<{ status: 'refunded' | 'refund_pending' }>('decline-pickup', {
    request_id: input.requestId,
    reason: input.reason,
  });

export async function resolveRelease(input: { requestId: string; note: string }) {
  const { error } = await supabase.rpc('resolve_dispute_release', {
    p_request_id: input.requestId,
    p_note: input.note,
  });
  if (error) throw error;
}

/** Refund goes through Razorpay, so it runs in an Edge Function. */
export const resolveRefund = (input: { requestId: string; note: string }) =>
  callFunction<{ status: 'refunded' }>('resolve-dispute-refund', {
    request_id: input.requestId,
    note: input.note,
  });
