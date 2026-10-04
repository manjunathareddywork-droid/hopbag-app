import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { AdminOnly } from '@/features/admin/admin-only';
import { useDashboard, useFunnel } from '@/features/safety/hooks';
import { t, type StringKey } from '@/i18n';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.tile}>
      <Text variant="heading">{String(value)}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

function AdminDashboard() {
  const dashboard = useDashboard();
  const funnel = useFunnel();

  if (!dashboard.data) {
    return (
      <LoadingView
        error={dashboard.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => dashboard.refetch()}
      />
    );
  }
  const d = dashboard.data;
  const toReview = d.pending_ids + d.pending_tickets + d.open_disputes;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dashboard.isRefetching}
          onRefresh={() => {
            dashboard.refetch();
            funnel.refetch();
          }}
        />
      }
    >
      <Text variant="heading">{t('adminDashboard.toReview')}</Text>
      <View style={styles.grid}>
        <Tile label={t('adminDashboard.pendingIds')} value={d.pending_ids} />
        <Tile label={t('adminDashboard.pendingTickets')} value={d.pending_tickets} />
        <Tile label={t('adminDashboard.openDisputes')} value={d.open_disputes} />
        <Tile label={t('adminDashboard.openReports')} value={d.open_reports} />
      </View>
      <Link href="/admin" asChild>
        <Button
          title={`${t('adminDashboard.reviewTravelers')} (${toReview})`}
          variant={toReview > 0 ? 'primary' : 'secondary'}
        />
      </Link>
      <Link href="/admin/reports" asChild>
        <Button title={`${t('adminDashboard.reports')} (${d.open_reports})`} variant="secondary" />
      </Link>

      <Text variant="heading" style={styles.section}>
        {t('adminDashboard.title')}
      </Text>
      <View style={styles.grid}>
        <Tile label={t('adminDashboard.users')} value={d.users} />
        <Tile label={t('adminDashboard.verifiedTravelers')} value={d.verified_travelers} />
        <Tile label={t('adminDashboard.openRequests')} value={d.open_requests} />
        <Tile label={t('adminDashboard.inProgress')} value={d.in_progress} />
        <Tile label={t('adminDashboard.completed')} value={d.completed} />
        <Tile label={t('adminDashboard.upcomingTrips')} value={d.upcoming_trips} />
        <Tile label={t('adminDashboard.held')} value={formatPaise(d.held_paise)} />
        <Tile label={t('adminDashboard.released')} value={formatPaise(d.released_paise)} />
        <Tile label={t('adminDashboard.fees')} value={formatPaise(d.fees_paise)} />
      </View>

      <Text variant="heading" style={styles.section}>
        {t('adminDashboard.funnel')}
      </Text>
      <View style={styles.card}>
        {(funnel.data ?? []).map((row) => (
          <View key={row.step} style={styles.funnelRow}>
            <Text variant="body" style={styles.funnelLabel}>
              {t(`adminDashboard.steps.${row.step}` as StringKey)}
            </Text>
            <Text variant="label">{String(row.count)}</Text>
          </View>
        ))}
      </View>

      <Link href="/admin/errors" asChild>
        <Pressable accessibilityRole="button" style={styles.card}>
          <View style={styles.funnelRow}>
            <Text variant="body" style={styles.funnelLabel}>
              {t('adminDashboard.errors24h')}
            </Text>
            <Text variant="label">{String(d.errors_24h)}</Text>
          </View>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

export default function AdminDashboardRoute() {
  return (
    <AdminOnly>
      <AdminDashboard />
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  section: {
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  funnelLabel: {
    flex: 1,
  },
});
