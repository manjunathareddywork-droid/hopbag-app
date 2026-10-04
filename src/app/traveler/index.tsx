import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { VerifiedBadge } from '@/components/verified-badge';
import { useCities } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useMyTrips, useMyVerification } from '@/features/travelers/hooks';
import { TripCard } from '@/features/travelers/trip-card';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

export default function TravelerHomeScreen() {
  const { data: profile } = useMyProfile();
  const verification = useMyVerification();
  const trips = useMyTrips();
  const cities = useCities();

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
});
