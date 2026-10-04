import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { PhotoField } from '@/components/photo-field';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { formatGrams } from '@/features/requests/weight';
import { useMyProfile } from '@/features/profile/hooks';
import { useCancelTrip, useResubmitTicket, useTrip } from '@/features/travelers/hooks';
import { normalizePnr, pnrSchema } from '@/features/travelers/schema';
import { t, type StringKey } from '@/i18n';
import type { Trip } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDate, todayIst } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const cities = useCities();
  const states = useStates();
  const cancel = useCancelTrip();
  const { data: profile } = useMyProfile();

  if (trip.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!trip.data || !cities.data) {
    return (
      <LoadingView
        error={trip.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          trip.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const tr = trip.data;
  const city = (cityId: number) =>
    cityLabel(
      cities.data.find((c) => c.id === cityId),
      states.data,
    );
  const ticketStatus = t(`reviewStatus.${tr.ticket_status}` as StringKey);

  function confirmCancel() {
    Alert.alert(t('trips.cancelConfirm'), undefined, [
      { text: t('trips.keep'), style: 'cancel' },
      { text: t('trips.cancelYes'), style: 'destructive', onPress: () => cancel.mutate(tr.id) },
    ]);
  }

  return (
    <Screen>
      <View style={styles.card}>
        <DetailRow
          label={t('trips.fields.route')}
          value={t('trips.route', { from: city(tr.from_city_id), to: city(tr.to_city_id) })}
        />
        <DetailRow label={t('trips.fields.date')} value={formatDate(tr.travel_date)} />
        <DetailRow
          label={t('trips.fields.mode')}
          value={t(`travelModes.${tr.mode}` as StringKey)}
        />
        <DetailRow
          label={t('trips.fields.capacity')}
          value={t('trips.capacityValue', {
            weight: formatGrams(tr.capacity_grams),
            items: tr.max_items,
          })}
        />
        <DetailRow label={t('trips.fields.pnr')} value={tr.pnr} />
        <DetailRow
          label={t('trips.ticket')}
          value={
            tr.status === 'active' ? ticketStatus : t(`trips.status.${tr.status}` as StringKey)
          }
        />
      </View>

      {tr.status === 'active' &&
      tr.ticket_status === 'approved' &&
      tr.travel_date >= todayIst() &&
      profile?.traveler_verified_at ? (
        <View style={[styles.card, styles.inner]}>
          <Text variant="body">{t('offers.howItWorks')}</Text>
          <Link href={{ pathname: '/traveler/feed', params: { tripId: tr.id } }} asChild>
            <Button title={t('offers.findOnTrip')} />
          </Link>
        </View>
      ) : null}

      {tr.status === 'active' && tr.ticket_status === 'rejected' ? (
        <ResubmitTicket trip={tr} />
      ) : null}

      {tr.status === 'active' ? (
        <View style={styles.actions}>
          {cancel.error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(cancel.error, 'trips.cancelFailed')}
            </Text>
          ) : null}
          <Button
            title={t('trips.cancelTrip')}
            variant="secondary"
            loading={cancel.isPending}
            onPress={confirmCancel}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function ResubmitTicket({ trip }: { trip: Trip }) {
  const resubmit = useResubmitTicket(trip.id);
  const [pnr, setPnr] = useState(trip.pnr);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  function send() {
    const parsed = pnrSchema.safeParse(pnr);
    if (!parsed.success) return setError(t('trips.errors.pnrInvalid'));
    if (!photo) return setError(t('trips.errors.ticketRequired'));
    setError(undefined);
    resubmit.mutate({ pnr: parsed.data, ticketUri: photo });
  }

  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <Text variant="body" style={styles.error}>
          {t('trips.ticketRejected', { reason: trip.ticket_reject_reason ?? '' })}
        </Text>
        <Text variant="heading">{t('trips.resubmitTitle')}</Text>
        <TextField
          label={t('trips.pnrLabel')}
          autoCapitalize="characters"
          value={pnr}
          onChangeText={(v) => setPnr(normalizePnr(v))}
        />
        <PhotoField
          label={t('trips.ticketLabel')}
          tip={t('trips.ticketTip')}
          value={photo}
          onChange={setPhoto}
        />
        {error || resubmit.error ? (
          <Text variant="body" style={styles.error}>
            {error ?? dbErrorMessage(resubmit.error, 'trips.resubmitFailed')}
          </Text>
        ) : null}
        <Button title={t('trips.resubmit')} loading={resubmit.isPending} onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inner: {
    padding: spacing.md,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
