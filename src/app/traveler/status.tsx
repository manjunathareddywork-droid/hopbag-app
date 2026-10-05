import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { InfoBox } from '@/components/info-box';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useMyProfile } from '@/features/profile/hooks';
import { useMyTrips, useMyVerification } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import type { ReviewStatus } from '@/lib/database.types';
import { colors, spacing } from '@/theme';

function statusBadge(status: ReviewStatus | 'none') {
  if (status === 'approved') return <Badge label={t('checking.verified')} tone="green" />;
  if (status === 'pending') return <Badge label={t('checking.inReview')} tone="peach" />;
  if (status === 'rejected') return <Badge label={t('checking.rejected')} tone="peach" />;
  return <Badge label={t('checking.notAdded')} tone="grey" />;
}

/** "We're checking your details": where the ID and ticket reviews stand. */
export default function TravelerStatusScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const verification = useMyVerification().data;
  const trips = useMyTrips().data ?? [];
  const latestTrip = trips.find((tr) => tr.status === 'active');
  const idStatus: ReviewStatus | 'none' = profile?.traveler_verified_at
    ? 'approved'
    : (verification?.status ?? 'none');

  return (
    <Screen
      footer={
        <>
          {idStatus === 'rejected' ? (
            <Button
              title={t('checking.tryAgain')}
              onPress={() => router.replace('/traveler/verify-id')}
            />
          ) : (
            <Button
              title={t('checking.addTrip')}
              onPress={() => router.replace('/traveler/trips/new')}
            />
          )}
          <Button
            title={t('checking.backHome')}
            variant="link"
            onPress={() => router.dismissTo('/')}
          />
        </>
      }
    >
      <View style={styles.top}>
        <View style={styles.circle}>
          <Icon name="clock" size={44} />
        </View>
        <Text variant="display" style={styles.center}>
          {t('checking.title')}
        </Text>
        <Text variant="body" muted style={styles.center}>
          {t('checking.body')}
        </Text>
      </View>
      <Card style={styles.list}>
        <Row label={t('checking.phone')} badge={statusBadge('approved')} />
        <Row label={t('checking.govId')} badge={statusBadge(idStatus)} />
        <Row
          label={t('checking.ticket')}
          badge={statusBadge(latestTrip?.ticket_status ?? 'none')}
        />
      </Card>
      {idStatus === 'rejected' && verification?.reject_reason ? (
        <InfoBox tone="danger" icon="alert-circle">
          {t('checking.rejectedReason', { reason: verification.reject_reason })}
        </InfoBox>
      ) : (
        <InfoBox tone="neutral">{t('checking.whileWait')}</InfoBox>
      )}
    </Screen>
  );
}

function Row({ label, badge }: { label: string; badge: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyStrong" style={styles.flex}>
        {label}
      </Text>
      {badge}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.peachTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
