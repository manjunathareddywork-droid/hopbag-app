import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { PhotoField } from '@/components/photo-field';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { cityItems } from '@/features/places/labels';
import { formatGrams } from '@/features/requests/weight';
import { t, type StringKey } from '@/i18n';
import type { City, State } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { colors, spacing } from '@/theme';

import {
  makeTripSchema,
  TRAVEL_MODES,
  type TripFormInput,
  type TripFormValues,
  type TripLimits,
} from './schema';

type Props = {
  cities: City[];
  states: State[];
  limits: TripLimits;
  saving: boolean;
  saveError?: string;
  onSubmit: (values: TripFormValues) => void;
};

export function TripForm({ cities, states, limits, saving, saveError, onSubmit }: Props) {
  const today = todayIst();
  const schema = useMemo(() => makeTripSchema(cities, limits, today), [cities, limits, today]);
  const { control, handleSubmit } = useForm<TripFormInput, unknown, TripFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromCityId: '',
      toCityId: '',
      travelDate: '',
      capacityKg: '',
      maxItems: String(limits.maxItems),
      pnr: '',
    },
  });

  const cityOptions = useMemo(() => cityItems(cities, states), [cities, states]);
  const modeOptions = TRAVEL_MODES.map((m) => ({
    value: m,
    label: t(`travelModes.${m}` as StringKey),
  }));
  const limitText = {
    items: String(limits.maxItems),
    weight: formatGrams(limits.maxGrams),
    days: String(limits.maxDaysAhead),
  };
  const errorText = (message?: string) =>
    message ? t(message as StringKey, limitText) : undefined;

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="fromCityId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('trips.fromLabel')}
            placeholder={t('requests.cityPlaceholder')}
            searchPlaceholder={t('requests.citySearch')}
            items={cityOptions}
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="toCityId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('trips.toLabel')}
            placeholder={t('requests.cityPlaceholder')}
            searchPlaceholder={t('requests.citySearch')}
            items={cityOptions}
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="travelDate"
        render={({ field, fieldState }) => (
          <DateField
            label={t('trips.dateLabel')}
            placeholder={t('trips.datePlaceholder')}
            value={field.value}
            onChange={field.onChange}
            minDate={today}
            maxDate={addDays(today, limits.maxDaysAhead)}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="mode"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('trips.modeLabel')}
            placeholder={t('trips.modePlaceholder')}
            items={modeOptions}
            value={field.value ?? ''}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="capacityKg"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <TextField
              label={t('trips.capacityLabel')}
              placeholder="3"
              keyboardType="decimal-pad"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
            />
            <Text variant="caption" muted>
              {t('trips.capacityHint', limitText)}
            </Text>
          </View>
        )}
      />
      <Controller
        control={control}
        name="maxItems"
        render={({ field, fieldState }) => (
          <TextField
            label={t('trips.maxItemsLabel')}
            keyboardType="number-pad"
            maxLength={2}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="pnr"
        render={({ field, fieldState }) => (
          <TextField
            label={t('trips.pnrLabel')}
            placeholder={t('trips.pnrPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="ticketUri"
        render={({ field, fieldState }) => (
          <PhotoField
            label={t('trips.ticketLabel')}
            tip={t('trips.ticketTip')}
            value={field.value ?? null}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      {saveError ? (
        <Text variant="body" style={styles.saveError} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}

      <Button title={t('trips.submit')} loading={saving} onPress={handleSubmit(onSubmit)} />
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
  saveError: {
    color: colors.danger,
  },
});
