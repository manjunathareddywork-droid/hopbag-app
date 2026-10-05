import type {
  AppSetting,
  UpcomingTrip,
  IdDocumentType,
  Trip,
  TripInsert,
  Verification,
} from '@/lib/database.types';
import { prepareJpeg } from '@/lib/images';
import { supabase } from '@/lib/supabase';

const DOCS_BUCKET = 'traveler-docs';
/** Documents need readable text: larger and less compressed than item photos. */
const DOC_WIDTH = 1600;
const DOC_QUALITY = 0.85;

export async function uploadDocument(
  userId: string,
  kind: 'id' | 'ticket',
  localUri: string,
): Promise<string> {
  const body = await prepareJpeg(localUri, DOC_WIDTH, DOC_QUALITY);
  const path = `${userId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function getDocumentUrl(path: string): Promise<string> {
  // Short-lived: these are ID documents.
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchSettings(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw error;
  return Object.fromEntries((data as AppSetting[]).map((row) => [row.key, row.int_value]));
}

/** The latest ID submission, or null if the user has never submitted one. */
export async function fetchMyVerification(userId: string): Promise<Verification | null> {
  const { data, error } = await supabase
    .from('traveler_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitVerification(
  userId: string,
  idType: IdDocumentType,
  photoUri: string,
): Promise<Verification> {
  const path = await uploadDocument(userId, 'id', photoUri);
  const { data, error } = await supabase
    .from('traveler_verifications')
    .insert({ id_type: idType, id_photo_path: path })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Verified upcoming trips into the caller's home state (safe fields only). */
export async function fetchUpcomingTrips(): Promise<UpcomingTrip[]> {
  const { data, error } = await supabase.rpc('upcoming_trips', {});
  if (error) throw error;
  return data;
}

export async function fetchMyTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('traveler_id', userId)
    .order('travel_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTrip(id: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTrip(
  userId: string,
  trip: Omit<TripInsert, 'ticket_photo_path'>,
  ticketUri: string,
): Promise<Trip> {
  const ticketPath = await uploadDocument(userId, 'ticket', ticketUri);
  const { data, error } = await supabase
    .from('trips')
    .insert({ ...trip, ticket_photo_path: ticketPath })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** After a rejection: new ticket photo and/or PNR. The database resets review to pending. */
export async function resubmitTicket(
  userId: string,
  tripId: string,
  pnr: string,
  ticketUri: string,
): Promise<Trip> {
  const ticketPath = await uploadDocument(userId, 'ticket', ticketUri);
  const { data, error } = await supabase
    .from('trips')
    .update({ pnr, ticket_photo_path: ticketPath })
    .eq('id', tripId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelTrip(id: string): Promise<Trip> {
  const { data, error } = await supabase.rpc('cancel_trip', { trip_id: id });
  if (error) throw error;
  return data;
}
