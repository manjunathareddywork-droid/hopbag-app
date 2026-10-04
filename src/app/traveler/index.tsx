import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { VerifiedBadge } from '@/components/verified-badge';
import { useCities } from '@/features/places/hooks';
import { useMyOffers, useRequestsByIds } from '@/features/offers/hooks';
import { useMyPayouts } from '@/features/delivery/hooks';
import { useHeldForMe } from '@/features/payments/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useMyTrips, useMyVerification } from '@/features/travelers/hooks';
import { TripCard } from '@/features/travelers/trip-card';
import { t, type StringKey } from '@/i18n';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

export default function TravelerHomeScreen() {
  const { data: profile } = useMyProfile();
  const verification = useMyVerification();
  const trips = useMyTrips();
  const cities = useCities();
  const myOffers = useMyOffers();
  const held = useHeldForMe();
  const payouts = useMyPayouts();
  // A captured payment stays 'captured' after release; released ones show as unlocked.
  const releasedPayments = new Set((payouts.data ?? []).map((p) => p.payment_id));
  const heldTotal = (held.data ?? [])
    .filter((p) => !releasedPayments.has(p.id))
    .reduce((sum, p) => sum + p.amount_paise, 0);
  const unlockedTotal = (payouts.data ?? [])
    .filter((p) => p.status === 'ready')
    .reduce((sum, p) => sum + p.net_paise, 0);
  const offeredRequests = useRequestsByIds((myOffers.data ?? []).map((o) => o.request_id));

  if (verification.isPending || !trips.data || !cities.data) {
    const failed = verification.isError || trips.isError || cities.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          verification.refetch();
          trips.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const verified = !!profile?.traveler_verified_at;
  const v = verification.data;

  return (
    <Screen>
      <Text variant="body" muted>
        {t('traveler.intro')}
      </Text>

      <View style={styles.card}>
        <Text variant="heading">{t('traveler.stepId')}</Text>
        {verified ? (
          <VerifiedBadge />
        ) : v?.status === 'pending' ? (
          <Text variant="body">{t('traveler.pendingId')}</Text>
        ) : (
          <>
            <Text variant="body" style={v?.status === 'rejected' ? styles.alert : undefined}>
              {v?.status === 'rejected'
                ? t('traveler.rejectedId', { reason: v.reject_reason ?? '' })
                : t('traveler.notStarted')}
            </Text>
            <Link href="/traveler/verify-id" asChild>
              <Button
                title={
                  v?.status === 'rejected' ? t('traveler.tryAgain') : t('traveler.verifyButton')
                }
              />
            </Link>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text variant="heading">{t('traveler.stepTrip')}</Text>
        <Link href="/traveler/trips/new" asChild>
          <Button title={t('traveler.addTrip')} variant={verified ? 'primary' : 'secondary'} />
        </Link>
      </View>

      {heldTotal > 0 ? (
        <View style={styles.card}>
          <Text variant="heading">{t('payment.heldForYou')}</Text>
          <Text variant="body">
            {t('payment.heldForYouValue', { amount: formatPaise(heldTotal) })}
          </Text>
        </View>
      ) : null}

      {unlockedTotal > 0 ? (
        <View style={styles.card}>
          <Text variant="heading">{t('wallet.unlocked')}</Text>
          <Text variant="body">
            {t('wallet.unlockedValue', { amount: formatPaise(unlockedTotal) })}
          </Text>
          <Text variant="caption" muted>
            {t('delivery.payoutNote')}
          </Text>
        </View>
      ) : null}

      {verified ? (
        <View style={styles.card}>
          <Text variant="heading">{t('offers.findButton')}</Text>
          <Text variant="body" muted>
            {t('offers.howItWorks')}
          </Text>
          <Link href="/traveler/feed" asChild>
            <Button title={t('offers.findButton')} />
          </Link>
        </View>
      ) : null}

      {verified ? (
        <View style={styles.list}>
          <Text variant="heading">{t('offers.myOffers')}</Text>
          {(myOffers.data ?? []).length === 0 ? (
            <Text variant="body" muted>
              {t('offers.noMyOffers')}
            </Text>
          ) : (
            (myOffers.data ?? []).map((o) => (
              <Link
                key={o.id}
                href={{
                  pathname: '/traveler/requests/[id]',
                  params: { id: o.request_id, tripId: o.trip_id },
                }}
                asChild
              >
                <Pressable accessibilityRole="button" style={styles.offer}>
                  <Text variant="label" style={styles.offerName} numberOfLines={1}>
                    {offeredRequests.data?.find((r) => r.id === o.request_id)?.item_name ?? ''}
                  </Text>
                  <Text variant="caption" muted>
                    {`${formatPaise(o.fare_paise)} · ${t(`offers.status.${o.status}` as StringKey)}`}
                  </Text>
                </Pressable>
              </Link>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.list}>
        <Text variant="heading">{t('traveler.myTrips')}</Text>
        {trips.data.length === 0 ? (
          <Text variant="body" muted>
            {t('traveler.noTrips')}
          </Text>
        ) : (
          trips.data.map((trip) => (
            <TripCard key={trip.id} trip={trip} cities={cities.data} href="/traveler/trips/[id]" />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  alert: {
    color: colors.danger,
  },
  list: {
    gap: spacing.md,
  },
  offer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  offerName: {
    flexShrink: 1,
  },
});
