import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { FareSlider } from '@/components/fare-slider';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { clampFare, fareBand, type FareSettings } from '@/features/offers/fare';
import { cityItems } from '@/features/places/labels';
import { t } from '@/i18n';
import type { BlockedTerm, Category, City, State } from '@/lib/database.types';
import { blockedReason } from '@/lib/db-errors';
import { addDays, todayIst } from '@/lib/dates';
import { pickImage } from '@/lib/images';
import { formatPaise } from '@/lib/money';
import { colors, fonts, radius, spacing } from '@/theme';

import { findBlockedTerm } from '../blocked';
import { categoryText } from '../labels';
import { requestFormError } from '../form-errors';
import { makeRequestSchema, MAX_DEADLINE_DAYS, type RequestFormValues } from '../schema';
import { formatGrams, kgToGrams } from '../weight';

type Props = {
  categories: Category[];
  cities: City[];
  states: State[];
  blockedTerms: BlockedTerm[];
  settings: FareSettings;
  initial: RequestFormValues;
  /** "Something else": the person also picks which allowed kind of item it is. */
  askCategory: boolean;
  onBack: (values: RequestFormValues) => void;
  onReview: (values: RequestFormValues) => void;
  onChooseAnother: () => void;
  onSeeAllowed: () => void;
};

const NOT_ALLOWED = ['medicines', 'alcohol', 'tobacco', 'cash', 'sealed', 'batteries'] as const;

/** Step 2: what, where, when, and how much. Blocked items are explained right away. */
export function DetailsStep({
  categories,
  cities,
  states,
  blockedTerms,
  settings,
  initial,
  askCategory,
  onBack,
  onReview,
  onChooseAnother,
  onSeeAllowed,
}: Props) {
  const today = todayIst();
  const schema = useMemo(
    () => makeRequestSchema({ categories, cities, blockedTerms, today }),
    [categories, cities, blockedTerms, today],
  );
  const { control, handleSubmit, setValue, getValues } = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  const [categoryId, itemName, details, weightKg, budget, photoUri] = useWatch({
    control,
    name: ['categoryId', 'itemName', 'details', 'weightKg', 'budgetRupees', 'photoUri'],
  });
  const category = categories.find((c) => c.id === categoryId);
  const blocked = findBlockedTerm(`${itemName} ${details}`, blockedTerms);
  const grams = kgToGrams(weightKg);
  const band = grams !== null ? fareBand(grams, settings) : null;
  const minRupees = band ? Math.ceil(band.minPaise / 100) : 0;
  const maxRupees = band ? Math.floor(band.maxPaise / 100) : 0;
  const fare = band
    ? clampFare(
        budget ? Number(budget) : Math.round((minRupees + maxRupees) / 20) * 10,
        minRupees,
        maxRupees,
      )
    : 0;

  const cityOptions = useMemo(() => cityItems(cities, states), [cities, states]);
  const categoryItems = categories.map((c) => ({ value: c.id, label: categoryText(c).name }));
  const error = (message?: string) => requestFormError(message);

  async function pickPhoto() {
    const uri = await pickImage();
    if (uri) setValue('photoUri', uri);
  }

  function review() {
    if (band) setValue('budgetRupees', String(fare));
    handleSubmit(onReview)();
  }

  const header = (
    <>
      <ScreenHeader
        title={t('newRequest.step2Title')}
        right={blocked ? undefined : t('common.stepOf', { n: 2, total: 3 })}
        onBack={() => onBack(getValues())}
      />
      {blocked ? null : <ProgressBar value={2 / 3} />}
    </>
  );

  const itemField = (
    <Controller
      control={control}
      name="itemName"
      render={({ field, fieldState }) => (
        <TextField
          label={t('newRequest.item')}
          placeholder={t('newRequest.itemPlaceholder')}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={
            blocked
              ? ' '
              : fieldState.error?.message?.startsWith('blocked')
                ? undefined
                : error(fieldState.error?.message)
          }
          hint={
            category && field.value.trim().length >= 2 ? (
              <View style={styles.allowed}>
                <Icon name="check" size={18} color={colors.success} />
                <Text variant="label" style={styles.allowedText}>
                  {t('newRequest.allowedAs', { category: categoryText(category).name })}
                </Text>
              </View>
            ) : undefined
          }
        />
      )}
    />
  );

  if (blocked) {
    return (
      <Screen
        footer={
          <>
            <Button title={t('newRequest.chooseAnother')} onPress={onChooseAnother} />
            <Button title={t('newRequest.fullList')} variant="link" onPress={onSeeAllowed} />
          </>
        }
      >
        {header}
        {itemField}
        <View style={styles.blocked} accessibilityLiveRegion="polite">
          <View style={styles.blockedTitle}>
            <View style={styles.blockedIcon}>
              <Icon name="slash" size={24} color={colors.white} />
            </View>
            <Text variant="heading" style={styles.blockedHeading}>
              {t('newRequest.blockedTitle')}
            </Text>
          </View>
          <Text variant="body" style={styles.blockedBody}>
            {blockedReason(blocked.reason_code)}
          </Text>
        </View>
        <Card style={styles.group}>
          <Text variant="bodyStrong">{t('newRequest.notAllowedTitle')}</Text>
          <View style={styles.chips}>
            {NOT_ALLOWED.map((key) => (
              <View key={key} style={styles.chip}>
                <Text variant="caption">{t(`newRequest.notAllowed.${key}`)}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('newRequest.review')} onPress={review} />}>
      {header}
      {askCategory ? (
        <Controller
          control={control}
          name="categoryId"
          render={({ field, fieldState }) => (
            <SelectField
              label={t('newRequest.pickCategory')}
              placeholder={t('requests.categoryPlaceholder')}
              items={categoryItems}
              value={field.value}
              onChange={field.onChange}
              error={error(fieldState.error?.message)}
            />
          )}
        />
      ) : null}
      {itemField}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="fromCityId"
            render={({ field, fieldState }) => (
              <SelectField
                label={t('newRequest.buyFrom')}
                placeholder={t('requests.cityPlaceholder')}
                searchPlaceholder={t('requests.citySearch')}
                items={cityOptions}
                value={field.value}
                onChange={field.onChange}
                error={error(fieldState.error?.message)}
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
                label={t('newRequest.deliverTo')}
                placeholder={t('requests.cityPlaceholder')}
                searchPlaceholder={t('requests.citySearch')}
                items={cityOptions}
                value={field.value}
                onChange={field.onChange}
                error={error(fieldState.error?.message)}
              />
            )}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="weightKg"
            render={({ field, fieldState }) => (
              <TextField
                label={t('newRequest.weight')}
                placeholder="0.5"
                suffix="kg"
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={error(fieldState.error?.message)}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="deadline"
            render={({ field, fieldState }) => (
              <DateField
                label={t('newRequest.neededBy')}
                placeholder={t('requests.deadlinePlaceholder')}
                value={field.value}
                onChange={field.onChange}
                minDate={addDays(today, 1)}
                maxDate={addDays(today, MAX_DEADLINE_DAYS)}
                error={error(fieldState.error?.message)}
                short
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="itemPriceRupees"
        render={({ field, fieldState }) => (
          <TextField
            label={t('newRequest.itemPrice')}
            prefix="Rs"
            placeholder={t('requests.itemPricePlaceholder')}
            keyboardType="number-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={error(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="budgetRupees"
        render={({ fieldState }) =>
          band && grams !== null ? (
            <View style={styles.group}>
              <FareSlider
                label={t('newRequest.carryFare')}
                value={fare}
                min={minRupees}
                max={maxRupees}
                valueText={formatPaise(fare * 100)}
                minText={formatPaise(minRupees * 100)}
                hint={t('newRequest.suggestedBand', {
                  weight: formatGrams(grams),
                  min: formatPaise(band.minPaise),
                  max: formatPaise(band.maxPaise),
                })}
                onChange={(v) => setValue('budgetRupees', String(v))}
              />
              {fieldState.error ? (
                <Text variant="caption" style={styles.error}>
                  {error(fieldState.error.message)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Card>
              <Text variant="label">{t('newRequest.carryFare')}</Text>
              <Text variant="caption" muted>
                {t('newRequest.enterWeightFirst')}
              </Text>
            </Card>
          )
        }
      />

      <Controller
        control={control}
        name="details"
        render={({ field, fieldState }) => (
          <TextField
            label={t('newRequest.notes')}
            placeholder={t('newRequest.notesPlaceholder')}
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={error(fieldState.error?.message)}
            style={styles.notes}
          />
        )}
      />

      <View style={styles.group}>
        <Text variant="label">{t('newRequest.photo')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? t('requests.changePhoto') : t('requests.addPhoto')}
          onPress={pickPhoto}
          style={styles.photoBox}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <>
              <Icon name="camera" size={24} />
              <Text variant="label">{t('requests.addPhoto')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md - 4 },
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  allowed: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  allowedText: { color: colors.success },
  error: { color: colors.danger },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  photoBox: {
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
  photo: { width: '100%', height: 160 },
  blocked: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.lg,
    padding: spacing.md + 4,
    gap: spacing.md,
  },
  blockedTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  blockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedHeading: { flex: 1, color: '#7A2410', fontFamily: fonts.heading, fontSize: 21 },
  blockedBody: { color: '#7A2410' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm,
  },
});
