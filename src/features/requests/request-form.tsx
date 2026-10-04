import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { cityItems } from '@/features/places/labels';
import { t, type StringKey } from '@/i18n';
import type { State } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { pickImage } from '@/lib/images';
import { colors, radius, spacing } from '@/theme';

import { blockedReason } from './errors';
import { categoryText } from './labels';
import {
  emptyRequestForm,
  makeRequestSchema,
  MAX_DEADLINE_DAYS,
  type RequestFormValues,
  type RequestRulesContext,
} from './schema';
import { formatGrams } from './weight';

type Props = RequestRulesContext & {
  states: State[];
  saving: boolean;
  saveError?: string;
  onSubmit: (values: RequestFormValues) => void;
};

/** Translates schema messages, including the two that carry a value. */
export function requestFormError(message?: string): string | undefined {
  if (!message) return undefined;
  const [key, value] = message.split(':');
  if (key === 'blocked') return t('requests.errors.blocked', { reason: blockedReason(value) });
  if (key === 'tooHeavy') return t('requests.errors.tooHeavy', { max: formatGrams(Number(value)) });
  return t(message as StringKey);
}

export function RequestForm({
  categories,
  cities,
  blockedTerms,
  states,
  saving,
  saveError,
  onSubmit,
}: Props) {
  const today = todayIst();
  const schema = useMemo(
    () => makeRequestSchema({ categories, cities, blockedTerms, today }),
    [categories, cities, blockedTerms, today],
  );
  const { control, handleSubmit, setValue } = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyRequestForm,
  });

  const categoryId = useWatch({ control, name: 'categoryId' });
  const photoUri = useWatch({ control, name: 'photoUri' });
  const category = categories.find((c) => c.id === categoryId);

  const categoryItems = categories.map((c) => ({
    value: c.id,
    label: categoryText(c).name,
    description: `${categoryText(c).description} ${t('requests.categoryHint', {
      max: formatGrams(c.max_weight_grams),
    })}`,
  }));

  const cityOptions = useMemo(() => cityItems(cities, states), [cities, states]);

  async function pickPhoto() {
    const uri = await pickImage();
    if (uri) setValue('photoUri', uri);
  }

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('requests.categoryLabel')}
            placeholder={t('requests.categoryPlaceholder')}
            items={categoryItems}
            value={field.value}
            onChange={field.onChange}
            hint={
              category
                ? t('requests.categoryHint', { max: formatGrams(category.max_weight_grams) })
                : undefined
            }
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="itemName"
        render={({ field, fieldState }) => (
          <TextField
            label={t('requests.itemNameLabel')}
            placeholder={t('requests.itemNamePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Link href="/not-allowed" style={styles.link}>
        <Text variant="label" style={styles.linkText}>
          {t('requests.notAllowedLink')}
        </Text>
      </Link>

      <Controller
        control={control}
        name="details"
        render={({ field, fieldState }) => (
          <TextField
            label={`${t('requests.detailsLabel')} ${t('common.optional')}`}
            placeholder={t('requests.detailsPlaceholder')}
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="weightKg"
        render={({ field, fieldState }) => (
          <TextField
            label={t('requests.weightLabel')}
            placeholder={t('requests.weightPlaceholder')}
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="fromCityId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('requests.fromLabel')}
            placeholder={t('requests.cityPlaceholder')}
            searchPlaceholder={t('requests.citySearch')}
            items={cityOptions}
            value={field.value}
            onChange={field.onChange}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="toCityId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('requests.toLabel')}
            placeholder={t('requests.cityPlaceholder')}
            searchPlaceholder={t('requests.citySearch')}
            items={cityOptions}
            value={field.value}
            onChange={field.onChange}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="deadline"
        render={({ field, fieldState }) => (
          <DateField
            label={t('requests.deadlineLabel')}
            placeholder={t('requests.deadlinePlaceholder')}
            value={field.value}
            onChange={field.onChange}
            minDate={addDays(today, 1)}
            maxDate={addDays(today, MAX_DEADLINE_DAYS)}
            error={requestFormError(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="budgetRupees"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <TextField
              label={t('requests.budgetLabel')}
              prefix="₹"
              placeholder={t('requests.budgetPlaceholder')}
              keyboardType="number-pad"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={requestFormError(fieldState.error?.message)}
            />
            <Text variant="caption" muted>
              {t('requests.budgetHint')}
            </Text>
          </View>
        )}
      />

      <View style={styles.group}>
        <Text variant="label">{`${t('requests.photoLabel')} ${t('common.optional')}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? t('requests.changePhoto') : t('requests.addPhoto')}
          onPress={pickPhoto}
          style={styles.photoBox}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <Text variant="label">{t('requests.addPhoto')}</Text>
          )}
        </Pressable>
      </View>

      <Text variant="caption" muted>
        {t('requests.inspectNote')}
      </Text>

      {saveError ? (
        <Text variant="body" style={styles.saveError} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}

      <Button title={t('requests.submit')} loading={saving} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  link: {
    marginTop: -spacing.sm,
    paddingVertical: spacing.xs,
  },
  linkText: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  photoBox: {
    height: 160,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  saveError: {
    color: colors.danger,
  },
});
