import { FlatList, StyleSheet, View } from 'react-native';

import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { AdminOnly } from '@/features/admin/admin-only';
import { useErrorGroups } from '@/features/safety/hooks';
import { t } from '@/i18n';
import { formatDateTime } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

function AdminErrors() {
  const groups = useErrorGroups();
  if (!groups.data) {
    return (
      <LoadingView
        error={groups.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => groups.refetch()}
      />
    );
  }
  return (
    <FlatList
      data={groups.data}
      keyExtractor={(g) => g.fingerprint}
      contentContainerStyle={styles.list}
      refreshing={groups.isRefetching}
      onRefresh={() => groups.refetch()}
      ListEmptyComponent={
        <Text variant="body" muted>
          {t('adminDashboard.noErrors')}
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text variant="label">{item.message}</Text>
          {item.screen ? (
            <Text variant="caption" muted>
              {item.screen}
            </Text>
          ) : null}
          <Text variant="caption" muted>
            {t('adminDashboard.errorLine', {
              count: item.occurrences,
              users: item.users,
              when: formatDateTime(item.last_seen),
            })}
          </Text>
        </View>
      )}
    />
  );
}

export default function AdminErrorsRoute() {
  return (
    <AdminOnly>
      <AdminErrors />
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
