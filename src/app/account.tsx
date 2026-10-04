import { Link } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { VerifiedBadge } from '@/components/verified-badge';
import { useIsAdmin } from '@/features/admin/hooks';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { signOut } from '@/features/auth/api';
import { formatIndianPhone } from '@/features/auth/phone';
import { useSession } from '@/features/auth/session';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { useAvatarUrl, useMyProfile } from '@/features/profile/hooks';
import { RatingBadge } from '@/features/ratings/rating-badge';
import { useRatingSummaries } from '@/features/ratings/hooks';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

export default function AccountScreen() {
  const { session } = useSession();
  const { data: profile } = useMyProfile();
  const { data: states } = useStates();
  const { data: cities } = useCities();
  const isAdmin = useIsAdmin().data === true;
  const myRating = useRatingSummaries(session?.user.id ? [session.user.id] : []);
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);

  if (!profile) return null;

  const phone = session?.user.phone ? formatIndianPhone(`+${session.user.phone}`) : '';

  function confirmSignOut() {
    Alert.alert(t('account.signOutConfirm'), undefined, [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('account.signOutYes'), style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar uri={avatarUrl} name={profile.full_name} size={104} />
        <Text variant="title">{profile.full_name}</Text>
        <RatingBadge summary={myRating.data?.[0]} />
        {profile.traveler_verified_at ? <VerifiedBadge /> : null}
      </View>

      <View style={styles.card}>
        <DetailRow label={t('account.phone')} value={phone} />
        <DetailRow
          label={t('account.home')}
          value={cityLabel(
            cities?.find((c) => c.id === profile.home_city_id),
            states,
          )}
        />
      </View>

      <View style={styles.actions}>
        {isAdmin ? (
          <Link href="/admin/dashboard" asChild>
            <Button title={t('admin.open')} />
          </Link>
        ) : null}
        <Link href="/edit-profile" asChild>
          <Button title={t('account.edit')} variant="secondary" />
        </Link>
        <Link href="/blocked" asChild>
          <Button title={t('safety.manageBlocked')} variant="secondary" />
        </Link>
        <Button title={t('account.signOut')} variant="secondary" onPress={confirmSignOut} />
        <View style={styles.legal}>
          <Link href="/legal/terms" style={styles.legalLink}>
            <Text variant="caption">{t('legal.termsTitle')}</Text>
          </Link>
          <Link href="/legal/privacy" style={styles.legalLink}>
            <Text variant="caption">{t('legal.privacyTitle')}</Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    gap: spacing.md,
  },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  legalLink: {
    paddingVertical: spacing.sm,
    textDecorationLine: 'underline',
  },
});
