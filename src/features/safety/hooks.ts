import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { track } from '@/lib/monitoring';

import {
  blockUser,
  fetchDashboard,
  fetchErrorGroups,
  fetchFunnel,
  fetchMyBlocks,
  fetchOpenReports,
  fetchReport,
  fetchSuspension,
  reportUser,
  reviewReport,
  setSuspension,
  unblockUser,
} from './api';

export const safetyKeys = {
  blocks: (userId: string) => ['safety', 'blocks', userId] as const,
  reports: ['safety', 'reports'] as const,
  report: (id: string) => ['safety', 'report', id] as const,
  suspension: (userId: string) => ['safety', 'suspension', userId] as const,
  dashboard: ['safety', 'dashboard'] as const,
  funnel: ['safety', 'funnel'] as const,
  errors: ['safety', 'errors'] as const,
};

/** Your own suspension (or, for admins, anyone's). */
export function useSuspension(userId: string | undefined) {
  return useQuery({
    queryKey: safetyKeys.suspension(userId ?? 'none'),
    queryFn: () => fetchSuspension(userId!),
    enabled: !!userId,
  });
}

export function useMyBlocks() {
  const userId = useSession().session?.user.id ?? '';
  return useQuery({
    queryKey: safetyKeys.blocks(userId),
    queryFn: () => fetchMyBlocks(userId),
    enabled: !!userId,
  });
}

/** Blocking changes what the feed, requests and chats show. */
function useRefreshAfter<T>(fn: (input: T) => Promise<void>, after?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      after?.();
      queryClient.invalidateQueries({ queryKey: ['safety'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export const useBlock = () => useRefreshAfter(blockUser, () => track('user_blocked'));
export const useUnblock = () => useRefreshAfter(unblockUser);
export const useReport = () => useRefreshAfter(reportUser, () => track('report_sent'));

export function useOpenReports() {
  return useQuery({ queryKey: safetyKeys.reports, queryFn: fetchOpenReports });
}

export function useReportDetail(id: string) {
  return useQuery({ queryKey: safetyKeys.report(id), queryFn: () => fetchReport(id) });
}

export const useReviewReport = () => useRefreshAfter(reviewReport);
export const useSetSuspension = () => useRefreshAfter(setSuspension);

export function useDashboard() {
  return useQuery({ queryKey: safetyKeys.dashboard, queryFn: fetchDashboard });
}

export function useFunnel() {
  return useQuery({ queryKey: safetyKeys.funnel, queryFn: () => fetchFunnel(30) });
}

export function useErrorGroups() {
  return useQuery({ queryKey: safetyKeys.errors, queryFn: () => fetchErrorGroups(24) });
}
