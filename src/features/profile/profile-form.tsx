import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t, type StringKey } from '@/i18n';
import { cityItems } from '@/features/places/labels';
import type { City, Profile, State } from '@/lib/database.types';
import { pickImage } from '@/lib/images';
import { colors, spacing } from '@/theme';

import { profileFormSchema, type ProfileFormValues } from './schema';

type Props = {
  profile: Profile | null;
  currentPhotoUrl?: string | null;
  cities: City[];
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
  cities,
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
      homeCityId: profile?.home_city_id ? String(profile.home_city_id) : '',
      photoUri: null,
    },
  });

  const photoUri = useWatch({ control, name: 'photoUri' });
  const fullName = useWatch({ control, name: 'fullName' });

  async function pickPhoto() {
    const uri = await pickImage({ square: true });
    if (uri) setValue('photoUri', uri);
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
        name="homeCityId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('profile.cityLabel')}
            placeholder={t('profile.cityPlaceholder')}
            searchPlaceholder={t('requests.citySearch')}
            items={cityItems(cities, states)}
            value={field.value}
            onChange={field.onChange}
            hint={t('profile.cityHint')}
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
