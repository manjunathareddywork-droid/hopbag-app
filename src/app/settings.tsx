import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import { InfoBox } from '@/components/info-box';
import { MenuGroup, MenuRow, ToggleRow } from '@/components/menu';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { signOut } from '@/features/auth/api';
import {
  useDeletionRequest,
  useMyProfile,
  useRequestDeletion,
  useSavePreferences,
} from '@/features/profile/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors, spacing } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const prefs = useSavePreferences();
  const deletion = useDeletionRequest();
  const requestDeletion = useRequestDeletion();
  const version = Constants.expoConfig?.version ?? '';

  function confirmSignOut() {
    Alert.alert(t('account.signOutConfirm'), undefined, [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('account.signOutYes'), style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function confirmDelete() {
    Alert.alert(t('settings.deleteConfirm'), undefined, [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteYes'),
        style: 'destructive',
        onPress: () => requestDeletion.mutate(),
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} />

      <Text variant="label" muted>
        {t('settings.preferences')}
      </Text>
      <MenuGroup>
        <MenuRow label={t('settings.language')} value={t('settings.english')} chevron={false} />
        <ToggleRow
          label={t('settings.push')}
          value={profile?.push_enabled ?? true}
          onChange={(v) => prefs.mutate({ push_enabled: v })}
        />
        <ToggleRow
          label={t('settings.offerAlerts')}
          value={profile?.offer_alerts ?? true}
          onChange={(v) => prefs.mutate({ offer_alerts: v })}
          last
        />
      </MenuGroup>
      {prefs.error ? (
        <Text variant="caption" style={styles.error}>
          {dbErrorMessage(prefs.error, 'profile.saveFailed')}
        </Text>
      ) : null}

      <Text variant="label" muted>
        {t('settings.safety')}
      </Text>
      <MenuGroup>
        <MenuRow label={t('settings.allowedItems')} onPress={() => router.push('/not-allowed')} />
        <MenuRow label={t('settings.howPayments')} onPress={() => router.push('/how-payments')} />
        <MenuRow label={t('settings.blocked')} onPress={() => router.push('/blocked')} />
        <MenuRow label={t('settings.support')} onPress={() => router.push('/support')} last />
      </MenuGroup>

      <Text variant="label" muted>
        {t('settings.account')}
      </Text>
      <MenuGroup>
        <MenuRow label={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <MenuRow label={t('legal.privacyTitle')} onPress={() => router.push('/legal/privacy')} />
        <MenuRow label={t('settings.signOut')} onPress={confirmSignOut} chevron={false} />
        <MenuRow
          label={t('settings.delete')}
          danger
          chevron={false}
          onPress={deletion.data ? undefined : confirmDelete}
          last
        />
      </MenuGroup>
      {deletion.data ? (
        <InfoBox tone="neutral" icon="info">
          {t('settings.deleteRequested')}
        </InfoBox>
      ) : null}
      {requestDeletion.error ? (
        <Text variant="caption" style={styles.error}>
          {dbErrorMessage(requestDeletion.error, 'profile.saveFailed')}
        </Text>
      ) : null}

      <Text variant="caption" muted style={styles.footer}>
        {t('settings.footer', { version })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  footer: { textAlign: 'center', marginTop: spacing.sm },
});
