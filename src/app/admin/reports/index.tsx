import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { AdminOnly } from '@/features/admin/admin-only';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useOpenReports } from '@/features/safety/hooks';
import { t, type StringKey } from '@/i18n';
import { formatDateTime } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

function AdminReports() {
  const reports = useOpenReports();
  const people = useProfilesByIds(
    (reports.data ?? []).flatMap((r) => [r.reporter_id, r.reported_user_id]),
  );
  const name = (id: string) => people.data?.find((p) => p.id === id)?.full_name ?? '';

  if (!reports.data) {
    return (
      <LoadingView
        error={reports.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => reports.refetch()}
      />
    );
  }
  return (
    <FlatList
      data={reports.data}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      refreshing={reports.isRefetching}
      onRefresh={() => reports.refetch()}
      ListEmptyComponent={
        <Text variant="body" muted>
          {t('adminDashboard.noReports')}
        </Text>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/admin/reports/[id]', params: { id: item.id } }} asChild>
          <Pressable accessibilityRole="button" style={styles.card}>
            <Text variant="label">{t(`safety.categories.${item.category}` as StringKey)}</Text>
            <Text variant="body" muted>
              {t('adminDashboard.reportFrom', {
                reporter: name(item.reporter_id),
                reported: name(item.reported_user_id),
              })}
            </Text>
            <Text variant="caption" muted>
              {formatDateTime(item.created_at)}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

export default function AdminReportsRoute() {
  return (
    <AdminOnly>
      <AdminReports />
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
