import { StyleSheet, View } from 'react-native';

import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSaveProfile, useStates } from '@/features/profile/hooks';
import { ProfileForm } from '@/features/profile/profile-form';
import { t } from '@/i18n';
import { spacing } from '@/theme';

export default function OnboardingScreen() {
  const states = useStates();
  const save = useSaveProfile();

  if (!states.data) {
    return (
      <LoadingView
        error={states.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => states.refetch()}
      />
    );
  }

  // After saving, the profile exists and the root navigator shows the home screen.
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{t('onboarding.title')}</Text>
        <Text variant="body" muted>
          {t('onboarding.subtitle')}
        </Text>
      </View>
      <ProfileForm
        profile={null}
        states={states.data}
        submitLabel={t('onboarding.submit')}
        saving={save.isPending}
        saveError={save.isError ? t('profile.saveFailed') : undefined}
        onSubmit={(values) => save.mutate(values)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
});
