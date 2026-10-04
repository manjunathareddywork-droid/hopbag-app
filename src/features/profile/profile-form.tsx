import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { StatePicker } from '@/components/state-picker';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t, type StringKey } from '@/i18n';
import type { Profile, State } from '@/lib/database.types';
import { colors, spacing } from '@/theme';

import { profileFormSchema, type ProfileFormValues } from './schema';

type Props = {
  profile: Profile | null;
  currentPhotoUrl?: string | null;
  states: State[];
  submitLabel: string;
  saving: boolean;
  saveError?: string;
  onSubmit: (values: ProfileFormValues) => void;
};

const errorText = (message?: string) => (message ? t(message as StringKey) : undefined);

export function ProfileForm({
  profile,
  currentPhotoUrl,
  states,
  submitLabel,
  saving,
  saveError,
  onSubmit,
}: Props) {
  const { control, handleSubmit, setValue } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile?.full_name ?? '',
      homeState: profile?.home_state ?? '',
      homeCity: profile?.home_city ?? '',
      photoUri: null,
    },
  });

  const photoUri = useWatch({ control, name: 'photoUri' });
  const fullName = useWatch({ control, name: 'fullName' });

  async function pickPhoto() {
    // Uses the system photo picker; no storage permission needed on modern Android.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setValue('photoUri', result.assets[0].uri);
  }

  return (
    <View style={styles.form}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.photoButton')}
        onPress={pickPhoto}
        style={styles.photo}
      >
        <Avatar uri={photoUri ?? currentPhotoUrl} name={fullName} size={104} />
        <Text variant="label">
          {photoUri || currentPhotoUrl ? t('profile.changePhoto') : t('profile.addPhoto')}
        </Text>
      </Pressable>

      <Controller
        control={control}
        name="fullName"
        render={({ field, fieldState }) => (
          <TextField
            label={t('profile.nameLabel')}
            placeholder={t('profile.namePlaceholder')}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="homeState"
        render={({ field, fieldState }) => (
          <StatePicker
            label={t('profile.stateLabel')}
            placeholder={t('profile.statePlaceholder')}
            closeLabel={t('common.close')}
            states={states}
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="homeCity"
        render={({ field, fieldState }) => (
          <TextField
            label={t('profile.cityLabel')}
            placeholder={t('profile.cityPlaceholder')}
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      {saveError ? (
        <Text variant="body" style={styles.saveError} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}

      <Button title={submitLabel} loading={saving} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  photo: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  saveError: {
    color: colors.danger,
  },
});
