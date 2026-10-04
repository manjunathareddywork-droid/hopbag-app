import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import {
  cancelRequest,
  createRequest,
  fetchBlockedTerms,
  fetchCategories,
  fetchCities,
  fetchMyRequests,
  fetchRequest,
  getRequestPhotoUrl,
} from './api';
import type { RequestFormValues } from './schema';

const HOUR = 60 * 60 * 1000;

export const requestKeys = {
  categories: ['categories'] as const,
  cities: ['cities'] as const,
  blockedTerms: ['blocked-terms'] as const,
  mine: ['requests', 'mine'] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
  photo: (path: string) => ['requests', 'photo', path] as const,
};

/** Reference data changes rarely; fetch once per hour at most. */
export function useCategories() {
  return useQuery({ queryKey: requestKeys.categories, queryFn: fetchCategories, staleTime: HOUR });
}

export function useCities() {
  return useQuery({ queryKey: requestKeys.cities, queryFn: fetchCities, staleTime: HOUR });
}

export function useBlockedTerms() {
  return useQuery({
    queryKey: requestKeys.blockedTerms,
    queryFn: fetchBlockedTerms,
    staleTime: HOUR,
  });
}

export function useMyRequests() {
  return useQuery({ queryKey: requestKeys.mine, queryFn: fetchMyRequests });
}

export function useRequest(id: string) {
  return useQuery({ queryKey: requestKeys.detail(id), queryFn: () => fetchRequest(id) });
}

export function useRequestPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: requestKeys.photo(path ?? 'none'),
    queryFn: () => getRequestPhotoUrl(path!),
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
  });
}

export function useCreateRequest() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RequestFormValues) => createRequest(session!.user.id, values),
    onSuccess: (created) => {
      queryClient.setQueryData(requestKeys.detail(created.id), created);
      queryClient.invalidateQueries({ queryKey: requestKeys.mine });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelRequest,
    onSuccess: (updated) => {
      queryClient.setQueryData(requestKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: requestKeys.mine });
    },
  });
}
