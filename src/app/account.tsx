import { Link } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { signOut } from '@/features/auth/api';
import { formatIndianPhone } from '@/features/auth/phone';
import { useSession } from '@/features/auth/session';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { useAvatarUrl, useMyProfile } from '@/features/profile/hooks';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

export default function AccountScreen() {
  const { session } = useSession();
  const { data: profile } = useMyProfile();
  const { data: states } = useStates();
  const { data: cities } = useCities();
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
      </View>

      <View style={styles.card}>
        <Row label={t('account.phone')} value={phone} />
        <Row
          label={t('account.home')}
          value={cityLabel(
            cities?.find((c) => c.id === profile.home_city_id),
            states,
          )}
        />
      </View>

      <View style={styles.actions}>
        <Link href="/edit-profile" asChild>
          <Button title={t('account.edit')} variant="secondary" />
        </Link>
        <Button title={t('account.signOut')} variant="secondary" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
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
  row: {
    padding: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actions: {
    gap: spacing.md,
  },
});
