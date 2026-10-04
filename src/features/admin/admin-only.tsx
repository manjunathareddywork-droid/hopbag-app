import type { ReactNode } from 'react';

import { LoadingView } from '@/components/loading-view';
import { t } from '@/i18n';

import { useIsAdmin } from './hooks';

/**
 * Shows admin screens to admins only. Navigation convenience: the database checks
 * admin rights on every read and action. Used instead of a Stack.Protected guard,
 * which flips after mount (the admin check is async) and makes the navigator update
 * before it has mounted.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (isAdmin.data === true) return <>{children}</>;
  if (isAdmin.data === false) return <LoadingView error={t('errors.adminsOnly')} />;
  return (
    <LoadingView
      error={isAdmin.isError ? t('common.networkError') : undefined}
      retryLabel={t('common.retry')}
      onRetry={() => isAdmin.refetch()}
    />
  );
}
