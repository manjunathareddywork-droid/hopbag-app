import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { PhotoField } from '@/components/photo-field';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useCities } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { RouteRequests } from '@/features/travelers/route-requests';
import { TripHero } from '@/features/travelers/trip-hero';
import { useTripLoads } from '@/features/travelers/trip-load';
import { useCancelTrip, useResubmitTicket, useTrip } from '@/features/travelers/hooks';
import { normalizePnr, pnrSchema } from '@/features/travelers/schema';
import { t, type StringKey } from '@/i18n';
import type { Trip } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { todayIst } from '@/lib/dates';
import { colors, spacing } from '@/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const cities = useCities();
  const cancel = useCancelTrip();
  const loads = useTripLoads();
  const { data: profile } = useMyProfile();
  const [confirmCancel, setConfirmCancel] = useState(false);

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
  const cityName = (cityId: number) => cities.data.find((c) => c.id === cityId)?.name ?? '';
  const live = tr.status === 'active' && tr.travel_date >= todayIst();

  return (
    <Screen>
      <ScreenHeader title={t('trips.detailTitle')} />
      <TripHero
        trip={tr}
        from={cityName(tr.from_city_id)}
        to={cityName(tr.to_city_id)}
        load={loads[tr.id]}
        label={
          tr.status === 'active'
            ? t(`travelModes.${tr.mode}` as StringKey)
            : t(`trips.status.${tr.status}` as StringKey)
        }
      />
      <Card>
        <DetailRow label={t('trips.fields.pnr')} value={tr.pnr} />
        <DetailRow
          label={t('trips.ticket')}
          value={t(`reviewStatus.${tr.ticket_status}` as StringKey)}
        />
      </Card>

      {live && tr.ticket_status === 'approved' && profile?.traveler_verified_at ? (
        <RouteRequests tripId={tr.id} />
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
          {confirmCancel ? (
            <Card style={styles.inner}>
              <Text variant="body">{t('trips.cancelConfirm')}</Text>
              <Button
                title={t('trips.cancelYes')}
                variant="outline"
                loading={cancel.isPending}
                onPress={() => cancel.mutate(tr.id)}
              />
              <Button
                title={t('trips.keep')}
                variant="link"
                onPress={() => setConfirmCancel(false)}
              />
            </Card>
          ) : (
            <Button
              title={t('trips.cancelTrip')}
              variant="dangerLink"
              onPress={() => setConfirmCancel(true)}
            />
          )}
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
    <Card>
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
    </Card>
  );
}

const styles = StyleSheet.create({
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
