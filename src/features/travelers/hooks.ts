import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import type { IdDocumentType, TripInsert } from '@/lib/database.types';

import {
  cancelTrip,
  createTrip,
  fetchMyTrips,
  fetchMyVerification,
  fetchSettings,
  fetchTrip,
  getDocumentUrl,
  resubmitTicket,
  submitVerification,
} from './api';

export const travelerKeys = {
  settings: ['settings'] as const,
  verification: (userId: string) => ['verification', userId] as const,
  trips: (userId: string) => ['trips', 'mine', userId] as const,
  trip: (id: string) => ['trips', 'detail', id] as const,
  document: (path: string) => ['document', path] as const,
};

function useUserId() {
  return useSession().session?.user.id ?? '';
}

export function useSettings() {
  return useQuery({
    queryKey: travelerKeys.settings,
    queryFn: fetchSettings,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMyVerification() {
  const userId = useUserId();
  return useQuery({
    queryKey: travelerKeys.verification(userId),
    queryFn: () => fetchMyVerification(userId),
    enabled: !!userId,
  });
}

export function useMyTrips() {
  const userId = useUserId();
  return useQuery({
    queryKey: travelerKeys.trips(userId),
    queryFn: () => fetchMyTrips(userId),
    enabled: !!userId,
  });
}

export function useTrip(id: string) {
  return useQuery({ queryKey: travelerKeys.trip(id), queryFn: () => fetchTrip(id) });
}

export function useDocumentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: travelerKeys.document(path ?? 'none'),
    queryFn: () => getDocumentUrl(path!),
    enabled: !!path,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitVerification() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idType, photoUri }: { idType: IdDocumentType; photoUri: string }) =>
      submitVerification(userId, idType, photoUri),
    onSuccess: (saved) => queryClient.setQueryData(travelerKeys.verification(userId), saved),
  });
}

export function useCreateTrip() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      trip,
      ticketUri,
    }: {
      trip: Omit<TripInsert, 'ticket_photo_path'>;
      ticketUri: string;
    }) => createTrip(userId, trip, ticketUri),
    onSuccess: (created) => {
      queryClient.setQueryData(travelerKeys.trip(created.id), created);
      queryClient.invalidateQueries({ queryKey: travelerKeys.trips(userId) });
    },
  });
}

export function useResubmitTicket(tripId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pnr, ticketUri }: { pnr: string; ticketUri: string }) =>
      resubmitTicket(userId, tripId, pnr, ticketUri),
    onSuccess: (updated) => {
      queryClient.setQueryData(travelerKeys.trip(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: travelerKeys.trips(userId) });
    },
  });
}

export function useCancelTrip() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelTrip,
    onSuccess: (updated) => {
      queryClient.setQueryData(travelerKeys.trip(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: travelerKeys.trips(userId) });
    },
  });
}
