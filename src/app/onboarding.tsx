import { StyleSheet, View } from 'react-native';

import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCities, useStates } from '@/features/places/hooks';
import { useMyProfile, useSaveProfile } from '@/features/profile/hooks';
import { ProfileForm } from '@/features/profile/profile-form';
import { t } from '@/i18n';
import { track } from '@/lib/monitoring';
import { spacing } from '@/theme';

export default function OnboardingScreen() {
  // Existing profile when an older account still needs to choose a city.
  const { data: profile } = useMyProfile();
  const states = useStates();
  const cities = useCities();
  const save = useSaveProfile();

  if (!states.data || !cities.data) {
    return (
      <LoadingView
        error={states.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          states.refetch();
          cities.refetch();
        }}
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
        profile={profile ?? null}
        cities={cities.data}
        states={states.data}
        submitLabel={t('onboarding.submit')}
        saving={save.isPending}
        saveError={save.isError ? t('profile.saveFailed') : undefined}
        onSubmit={(values) =>
          save.mutate(values, { onSuccess: () => track('onboarding_completed') })
        }
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
