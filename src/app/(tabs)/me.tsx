import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { MenuGroup, MenuRow } from '@/components/menu';
import { Screen } from '@/components/screen';
import { Stat } from '@/components/stat';
import { Text } from '@/components/text';
import { useIsAdmin } from '@/features/admin/hooks';
import { useSession } from '@/features/auth/session';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { useAvatarUrl, useMyProfile, useProfileStats } from '@/features/profile/hooks';
import { useMyVerification } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import { spacing } from '@/theme';

export default function MeScreen() {
  const router = useRouter();
  const userId = useSession().session?.user.id;
  const { data: profile } = useMyProfile();
  const stats = useProfileStats(userId).data;
  const avatar = useAvatarUrl(profile?.avatar_path).data;
  const cities = useCities().data;
  const states = useStates().data;
  const verification = useMyVerification().data;
  const isAdmin = useIsAdmin().data === true;

  if (!profile) return null;
  const verified = !!profile.traveler_verified_at;
  const verificationBadge = verified ? (
    <Badge label={t('me.approved')} tone="green" />
  ) : verification?.status === 'pending' ? (
    <Badge label={t('me.inReview')} tone="peach" />
  ) : (
    <Badge label={t('me.notStarted')} tone="grey" />
  );

  return (
    <Screen inTabs>
      <View style={styles.top}>
        <Text variant="title" style={styles.flex}>
          {t('me.title')}
        </Text>
        <IconButton
          icon="settings"
          label={t('me.settings')}
          onPress={() => router.push('/settings')}
        />
      </View>

      <Card
        style={styles.profile}
        onPress={() => router.push('/edit-profile')}
        accessibilityLabel={t('me.editProfile')}
      >
        <Avatar uri={avatar} name={profile.full_name} size={80} />
        <View style={styles.flex}>
          <Text variant="screenTitle">{profile.full_name}</Text>
          <Text variant="caption" muted>
            {cityLabel(
              cities?.find((c) => c.id === profile.home_city_id),
              states,
            )}
          </Text>
          <View style={styles.badges}>
            <Badge label={t('me.phoneVerified')} tone="green" />
            {verified ? <Badge label={t('me.traveler')} tone="green" /> : null}
          </View>
        </View>
      </Card>

      <View style={styles.stats}>
        <Stat
          boxed
          value={stats?.rating != null ? stats.rating.toFixed(1) : '–'}
          label={t('me.rating')}
        />
        <Stat boxed value={String(stats?.requests ?? 0)} label={t('me.requests')} />
        <Stat boxed value={String(stats?.deliveries ?? 0)} label={t('me.deliveries')} />
      </View>

      <MenuGroup>
        <MenuRow
          icon="credit-card"
          label={t('me.earnings')}
          onPress={() => router.push('/earnings')}
        />
        <MenuRow
          icon="navigation"
          label={t('me.myTrips')}
          onPress={() => router.navigate('/trips')}
        />
        <MenuRow
          icon="shield"
          label={t('me.verification')}
          right={verificationBadge}
          onPress={() =>
            router.push(verified || verification ? '/traveler/status' : '/traveler/verify-id')
          }
        />
        <MenuRow
          icon="edit-2"
          label={t('me.editProfile')}
          onPress={() => router.push('/edit-profile')}
        />
        <MenuRow
          icon="alert-circle"
          label={t('me.help')}
          onPress={() => router.push('/settings')}
          last={!isAdmin}
        />
        {isAdmin ? (
          <MenuRow
            icon="tool"
            label={t('me.admin')}
            onPress={() => router.push('/admin/dashboard')}
            last
          />
        ) : null}
      </MenuGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  flex: { flex: 1, gap: 2 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md + 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.md - 4 },
});
