import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { usePendingTickets, usePendingVerifications } from '@/features/admin/hooks';
import { useOpenDisputes } from '@/features/delivery/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useCities } from '@/features/places/hooks';
import { TripCard } from '@/features/travelers/trip-card';
import { t, type StringKey } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

export default function AdminScreen() {
  const ids = usePendingVerifications();
  const tickets = usePendingTickets();
  const cities = useCities();
  const disputes = useOpenDisputes();
  const people = useProfilesByIds([
    ...(disputes.data ?? []).map((d) => d.raised_by),
    ...(ids.data ?? []).map((v) => v.user_id),
    ...(tickets.data ?? []).map((tr) => tr.traveler_id),
  ]);

  if (!ids.data || !tickets.data || !cities.data) {
    const failed = ids.isError || tickets.isError || cities.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          ids.refetch();
          tickets.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const name = (userId: string) => people.data?.find((p) => p.id === userId)?.full_name ?? '';
  const refreshing = ids.isRefetching || tickets.isRefetching;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            ids.refetch();
            tickets.refetch();
            disputes.refetch();
          }}
        />
      }
    >
      <Text variant="heading">{t('adminDisputes.open')}</Text>
      {(disputes.data ?? []).length === 0 ? (
        <Text variant="body" muted>
          {t('adminDisputes.none')}
        </Text>
      ) : (
        (disputes.data ?? []).map((d) => (
          <Link
            key={d.id}
            href={{ pathname: '/admin/disputes/[requestId]', params: { requestId: d.request_id } }}
            asChild
          >
            <Pressable accessibilityRole="button" style={styles.card}>
              <Text variant="label">{name(d.raised_by)}</Text>
              <Text variant="body" muted numberOfLines={2}>
                {d.reason}
              </Text>
              <Text variant="caption" muted>
                {t('admin.submitted', { date: formatDate(d.created_at.slice(0, 10)) })}
              </Text>
            </Pressable>
          </Link>
        ))
      )}

      <View style={styles.section}>
        <Text variant="heading">{t('admin.pendingIds')}</Text>
      </View>
      {ids.data.length === 0 ? (
        <Text variant="body" muted>
          {t('admin.nothingPending')}
        </Text>
      ) : (
        ids.data.map((v) => (
          <Link
            key={v.id}
            href={{ pathname: '/admin/verifications/[id]', params: { id: v.id } }}
            asChild
          >
            <Pressable accessibilityRole="button" style={styles.card}>
              <Text variant="label">{name(v.user_id)}</Text>
              <Text variant="body" muted>
                {t(`idTypes.${v.id_type}` as StringKey)}
              </Text>
              <Text variant="caption" muted>
                {t('admin.submitted', { date: formatDate(v.created_at.slice(0, 10)) })}
              </Text>
            </Pressable>
          </Link>
        ))
      )}

      <View style={styles.section}>
        <Text variant="heading">{t('admin.pendingTickets')}</Text>
      </View>
      {tickets.data.length === 0 ? (
        <Text variant="body" muted>
          {t('admin.nothingPending')}
        </Text>
      ) : (
        tickets.data.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            cities={cities.data}
            href="/admin/trips/[id]"
            subtitle={name(trip.traveler_id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  section: {
    marginTop: spacing.lg,
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
