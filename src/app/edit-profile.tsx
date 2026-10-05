import { useRouter } from 'expo-router';

import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useCities, useStates } from '@/features/places/hooks';
import { useAvatarUrl, useMyProfile, useSaveProfile } from '@/features/profile/hooks';
import { ProfileForm } from '@/features/profile/profile-form';
import { t } from '@/i18n';

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const states = useStates();
  const cities = useCities();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);
  const save = useSaveProfile();

  if (!profile || !states.data || !cities.data) {
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

  return (
    <Screen>
      <ScreenHeader title={t('editProfile.title')} />
      <ProfileForm
        profile={profile}
        currentPhotoUrl={avatarUrl}
        cities={cities.data}
        states={states.data}
        submitLabel={t('editProfile.submit')}
        saving={save.isPending}
        saveError={save.isError ? t('profile.saveFailed') : undefined}
        onSubmit={(values) => save.mutate(values, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
