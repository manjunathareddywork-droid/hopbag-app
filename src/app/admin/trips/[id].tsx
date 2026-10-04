import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { VerifiedBadge } from '@/components/verified-badge';
import { AdminOnly } from '@/features/admin/admin-only';
import { useReviewTicket } from '@/features/admin/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { formatGrams } from '@/features/requests/weight';
import { useDocumentUrl, useTrip } from '@/features/travelers/hooks';
import { ReviewPanel } from '@/features/admin/review-panel';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDate } from '@/lib/dates';
import { colors, radius } from '@/theme';

function ReviewTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trip = useTrip(id);
  const cities = useCities();
  const states = useStates();
  const people = useProfilesByIds(trip.data ? [trip.data.traveler_id] : []);
  const ticket = useDocumentUrl(trip.data?.ticket_photo_path);
  const review = useReviewTicket();

  if (trip.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!trip.data || !cities.data) {
    return (
      <LoadingView
        error={trip.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => trip.refetch()}
      />
    );
  }

  const tr = trip.data;
  const person = people.data?.[0];
  const city = (cityId: number) =>
    cityLabel(
      cities.data.find((c) => c.id === cityId),
      states.data,
    );

  return (
    <Screen>
      {ticket.data ? (
        <Image
          source={{ uri: ticket.data }}
          style={styles.photo}
          contentFit="contain"
          accessibilityLabel={t('trips.ticketLabel')}
        />
      ) : null}

      <View style={styles.card}>
        <DetailRow label={t('admin.person')} value={person?.full_name ?? ''} />
        <DetailRow
          label={t('trips.fields.route')}
          value={t('trips.route', { from: city(tr.from_city_id), to: city(tr.to_city_id) })}
        />
        <DetailRow label={t('trips.fields.date')} value={formatDate(tr.travel_date)} />
        <DetailRow
          label={t('trips.fields.mode')}
          value={t(`travelModes.${tr.mode}` as StringKey)}
        />
        <DetailRow label={t('trips.fields.pnr')} value={tr.pnr} />
        <DetailRow
          label={t('trips.fields.capacity')}
          value={t('trips.capacityValue', {
            weight: formatGrams(tr.capacity_grams),
            items: tr.max_items,
          })}
        />
      </View>

      {person?.traveler_verified_at ? <VerifiedBadge /> : null}

      {tr.ticket_status === 'pending' && tr.status === 'active' ? (
        <ReviewPanel
          saving={review.isPending}
          error={review.error ? dbErrorMessage(review.error, 'admin.reviewFailed') : undefined}
          onApprove={() =>
            review.mutate({ id: tr.id, approve: true }, { onSuccess: () => router.back() })
          }
          onReject={(reason) =>
            review.mutate({ id: tr.id, approve: false, reason }, { onSuccess: () => router.back() })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

export default function ReviewTicketScreenRoute() {
  return (
    <AdminOnly>
      <ReviewTicketScreen />
    </AdminOnly>
  );
}
