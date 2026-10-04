import { useQuery } from '@tanstack/react-query';

import { fetchCities, fetchStates } from './api';

const HOUR = 60 * 60 * 1000;

export const placeKeys = {
  states: ['states'] as const,
  cities: ['cities'] as const,
};

/** Reference data changes rarely; fetch once per hour at most. */
export function useStates() {
  return useQuery({ queryKey: placeKeys.states, queryFn: fetchStates, staleTime: Infinity });
}

export function useCities() {
  return useQuery({ queryKey: placeKeys.cities, queryFn: fetchCities, staleTime: HOUR });
}
