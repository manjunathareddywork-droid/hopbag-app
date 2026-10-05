import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { InfoBox } from '@/components/info-box';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { cityItems } from '@/features/places/labels';
import { formatGrams, gramsToKg, kgToGrams } from '@/features/requests/weight';
import { t, type StringKey } from '@/i18n';
import type { City, State } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { pickImage, takePhoto } from '@/lib/images';
import { colors, radius, spacing } from '@/theme';

import {
  makeTripSchema,
  normalizePnr,
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

const STEP_GRAMS = 500;

const kg = gramsToKg;

/** Post a trip: route and date, space for items, and the ticket for review. */
export function TripForm({ cities, states, limits, saving, saveError, onSubmit }: Props) {
  const today = todayIst();
  const schema = useMemo(() => makeTripSchema(cities, limits, today), [cities, limits, today]);
  const { control, handleSubmit, setValue } = useForm<TripFormInput, unknown, TripFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromCityId: '',
      toCityId: '',
      travelDate: '',
      capacityKg: String(Math.min(3, limits.maxGrams / 1000)),
      maxItems: String(limits.maxItems),
      pnr: '',
    },
  });
  const [capacityKg, pnr, ticketUri] = useWatch({
    control,
    name: ['capacityKg', 'pnr', 'ticketUri'],
  });
  const grams = kgToGrams(capacityKg) ?? STEP_GRAMS;

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

  async function addTicket(camera: boolean) {
    const uri = camera ? (await takePhoto()).uri : await pickImage();
    if (uri) setValue('ticketUri', uri, { shouldValidate: true });
  }

  return (
    <Screen
      footer={
        <Button title={t('postTrip.publish')} loading={saving} onPress={handleSubmit(onSubmit)} />
      }
    >
      <ScreenHeader title={t('postTrip.title')} />
      <Card style={styles.group}>
        <View style={styles.row}>
          <View style={styles.flex}>
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
          </View>
          <View style={styles.flex}>
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
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
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
                  short
                />
              )}
            />
          </View>
          <View style={styles.flex}>
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
          </View>
        </View>
      </Card>

      <Controller
        control={control}
        name="capacityKg"
        render={({ fieldState }) => (
          <Card style={styles.group}>
            <View>
              <Text variant="bodyStrong">{t('postTrip.space')}</Text>
              <Text variant="caption" muted>
                {t('postTrip.spaceHint', limitText)}
              </Text>
            </View>
            <Stepper
              value={grams}
              min={STEP_GRAMS}
              max={limits.maxGrams}
              step={STEP_GRAMS}
              unit="kg"
              format={kg}
              onChange={(g) => setValue('capacityKg', kg(g))}
            />
            {fieldState.error ? (
              <Text variant="caption" style={styles.error}>
                {errorText(fieldState.error.message)}
              </Text>
            ) : null}
          </Card>
        )}
      />

      <Card style={styles.group}>
        <Text variant="bodyStrong">{t('postTrip.ticket')}</Text>
        <Controller
          control={control}
          name="pnr"
          render={({ field, fieldState }) => (
            <TextField
              label={t('trips.pnrLabel')}
              placeholder={t('trips.pnrPlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              muted
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
          render={({ fieldState }) => (
            <View style={styles.group}>
              <Pressable
                accessibilityRole="button"
                onPress={() => addTicket(true)}
                style={styles.upload}
              >
                {ticketUri ? (
                  <Image source={{ uri: ticketUri }} style={styles.preview} contentFit="contain" />
                ) : (
                  <>
                    <Icon name="camera" size={24} />
                    <Text variant="bodyStrong">{t('trips.ticketLabel')}</Text>
                  </>
                )}
              </Pressable>
              <Button title={t('photo.choose')} variant="link" onPress={() => addTicket(false)} />
              {fieldState.error ? (
                <Text variant="caption" style={styles.error}>
                  {errorText(fieldState.error.message)}
                </Text>
              ) : null}
            </View>
          )}
        />
        {ticketUri && normalizePnr(pnr ?? '').length >= 5 ? (
          <InfoBox icon="shield">
            {t('postTrip.ticketPending', { pnr: normalizePnr(pnr ?? '') })}
          </InfoBox>
        ) : (
          <Text variant="caption" muted>
            {t('trips.ticketTip')}
          </Text>
        )}
      </Card>

      {saveError ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md - 4 },
  row: { flexDirection: 'row', gap: spacing.md - 4 },
  flex: { flex: 1 },
  upload: {
    minHeight: 96,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textSubtle,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 160 },
  error: { color: colors.danger },
});
