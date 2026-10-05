import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ChoiceChip } from '@/components/choice';
import { Icon } from '@/components/icon';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t, type StringKey } from '@/i18n';
import { cityItems } from '@/features/places/labels';
import type { City, Intent, Profile, State } from '@/lib/database.types';
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

const INTENTS: Intent[] = ['get', 'carry', 'both'];

const errorText = (message?: string) => (message ? t(message as StringKey) : undefined);

/** Photo, name, home city (state follows from it) and what the person wants to do. */
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
      intent: profile?.intent ?? 'get',
    },
  });

  const photoUri = useWatch({ control, name: 'photoUri' });
  const fullName = useWatch({ control, name: 'fullName' });
  const homeCityId = useWatch({ control, name: 'homeCityId' });
  const city = cities.find((c) => String(c.id) === homeCityId);
  const stateName = states.find((s) => s.code === city?.state_code)?.name ?? '';
  const hasPhoto = !!(photoUri || currentPhotoUrl);

  async function pickPhoto() {
    const uri = await pickImage({ square: true });
    if (uri) setValue('photoUri', uri);
  }

  return (
    <View style={styles.form}>
      <View style={styles.photoRow}>
        {hasPhoto || fullName.trim() ? (
          <Avatar uri={photoUri ?? currentPhotoUrl} name={fullName} size={88} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="user" size={32} />
          </View>
        )}
        <Button
          title={hasPhoto ? t('setup.changePhoto') : t('setup.addPhoto')}
          variant="outline"
          accessibilityLabel={t('profile.photoButton')}
          onPress={pickPhoto}
          style={styles.photoButton}
        />
      </View>

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

      <View style={styles.row}>
        <View style={styles.flex}>
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
                error={errorText(fieldState.error?.message)}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('setup.state')}
            value={stateName}
            placeholder={t('setup.statePlaceholder')}
            editable={false}
            numberOfLines={1}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="intent"
        render={({ field }) => (
          <View style={styles.group}>
            <Text variant="label">{t('setup.intentLabel')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {INTENTS.map((intent) => (
                <ChoiceChip
                  key={intent}
                  size="lg"
                  label={t(`setup.intents.${intent}`)}
                  selected={field.value === intent}
                  onPress={() => field.onChange(intent)}
                />
              ))}
            </View>
            <Text variant="caption" muted>
              {t('setup.intentHint')}
            </Text>
          </View>
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
  form: { gap: spacing.lg - 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  placeholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: { minHeight: 48 },
  row: { flexDirection: 'row', gap: spacing.md - 4 },
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  saveError: { color: colors.danger },
});
