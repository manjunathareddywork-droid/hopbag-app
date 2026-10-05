import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useMyOffers, useRequestsByIds } from '@/features/offers/hooks';
import { useCities } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useMyTrips, useMyVerification } from '@/features/travelers/hooks';
import { RouteRequests } from '@/features/travelers/route-requests';
import { TripHero } from '@/features/travelers/trip-hero';
import { useTripLoads } from '@/features/travelers/trip-load';
import { t, type StringKey } from '@/i18n';
import type { RequestStatus } from '@/lib/database.types';
import { formatDay, todayIst } from '@/lib/dates';
import { spacing } from '@/theme';

const DELIVERING: RequestStatus[] = ['accepted', 'paid', 'picked_up', 'delivered', 'disputed'];

export default function TripsScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const verification = useMyVerification();
  const trips = useMyTrips();
  const cities = useCities();
  const loads = useTripLoads();
  const myOffers = useMyOffers();
  const accepted = (myOffers.data ?? []).filter((o) => o.status === 'accepted');
  const acceptedRequests = useRequestsByIds(accepted.map((o) => o.request_id));

  if (!trips.data || !cities.data || verification.isPending) {
    const failed = trips.isError || cities.isError || verification.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          trips.refetch();
          cities.refetch();
          verification.refetch();
        }}
      />
    );
  }

  const verified = !!profile?.traveler_verified_at;
  const v = verification.data;
  const today = todayIst();
  const cityName = (id: number) => cities.data.find((c) => c.id === id)?.name ?? '';
  const upcoming = trips.data
    .filter((tr) => tr.status === 'active' && tr.travel_date >= today)
    .sort((a, b) => a.travel_date.localeCompare(b.travel_date));
  const next = upcoming[0];
  const delivering = (acceptedRequests.data ?? []).filter((r) => DELIVERING.includes(r.status));

  const postTrip = (
    <Button
      title={t('tripsTab.postTrip')}
      variant={next ? 'outline' : 'primary'}
      onPress={() => router.push('/traveler/trips/new')}
    />
  );

  return (
    <Screen inTabs>
      <Text variant="title" style={styles.title}>
        {t('tripsTab.title')}
      </Text>

      {!verified && !v ? (
        <Card style={styles.group}>
          <IconTile name="navigation" tone="tealTint" />
          <Text variant="heading">{t('tripsTab.becomeTitle')}</Text>
          <Text variant="body" muted>
            {t('tripsTab.becomeBody')}
          </Text>
          <Button title={t('tripsTab.become')} onPress={() => router.push('/traveler/verify-id')} />
        </Card>
      ) : null}
      {!verified && v ? (
        <Card style={styles.row} onPress={() => router.push('/traveler/status')}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('me.verification')}</Text>
            <Text variant="caption" muted>
              {v.status === 'rejected'
                ? t('checking.rejectedReason', { reason: v.reject_reason ?? '' })
                : t('tripsTab.waitingVerification')}
            </Text>
          </View>
          <Badge
            label={v.status === 'rejected' ? t('checking.rejected') : t('checking.inReview')}
            tone="peach"
          />
        </Card>
      ) : null}

      {delivering.length > 0 ? (
        <View style={styles.group}>
          <Text variant="heading">{t('tripsTab.activeDeliveries')}</Text>
          {delivering.map((r) => (
            <Card
              key={r.id}
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/traveler/requests/[id]', params: { id: r.id } })
              }
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong">{r.item_name}</Text>
                <Text variant="caption" muted>
                  {t('requests.route', {
                    from: cityName(r.from_city_id),
                    to: cityName(r.to_city_id),
                  })}
                </Text>
              </View>
              <Badge label={t(`status.${r.status}` as StringKey)} tone="blue" />
            </Card>
          ))}
        </View>
      ) : null}

      {next ? (
        <>
          <TripHero
            trip={next}
            from={cityName(next.from_city_id)}
            to={cityName(next.to_city_id)}
            load={loads[next.id]}
            label={t('tripsTab.nextTrip')}
            onPress={() =>
              router.push({ pathname: '/traveler/trips/[id]', params: { id: next.id } })
            }
          />
          {verified && next.ticket_status === 'approved' ? (
            <RouteRequests tripId={next.id} />
          ) : null}
        </>
      ) : verified || v ? (
        <Text variant="body" muted>
          {t('tripsTab.noTrips')}
        </Text>
      ) : null}

      {upcoming.length > 1 ? (
        <View style={styles.group}>
          <Text variant="heading">{t('tripsTab.otherTrips')}</Text>
          {upcoming.slice(1).map((tr) => (
            <Card
              key={tr.id}
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/traveler/trips/[id]', params: { id: tr.id } })
              }
            >
              <Text variant="bodyStrong" style={styles.flex}>
                {t('requests.route', {
                  from: cityName(tr.from_city_id),
                  to: cityName(tr.to_city_id),
                })}
              </Text>
              <Text variant="caption" muted>
                {formatDay(tr.travel_date)}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      {verified || v ? postTrip : null}
      {!verified && v?.status === 'pending' ? (
        <InfoBox tone="neutral" icon="info">
          {t('checking.whileWait')}
        </InfoBox>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.sm },
  group: { gap: spacing.md - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
