import { useRouter } from 'expo-router';

import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { useAvatarUrl, useMyProfile, useSaveProfile, useStates } from '@/features/profile/hooks';
import { ProfileForm } from '@/features/profile/profile-form';
import { t } from '@/i18n';

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const states = useStates();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);
  const save = useSaveProfile();

  if (!profile || !states.data) {
    return (
      <LoadingView
        error={states.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => states.refetch()}
      />
    );
  }

  return (
    <Screen>
      <ProfileForm
        profile={profile}
        currentPhotoUrl={avatarUrl}
        states={states.data}
        submitLabel={t('editProfile.submit')}
        saving={save.isPending}
        saveError={save.isError ? t('profile.saveFailed') : undefined}
        onSubmit={(values) => save.mutate(values, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
