import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { InfoBox } from '@/components/info-box';
import { MoneyRows } from '@/components/money-rows';
import { ProgressBar } from '@/components/progress';
import { RouteArc } from '@/components/route-line';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { platformFee } from '@/features/payments/fee';
import { t } from '@/i18n';
import type { Category, City } from '@/lib/database.types';
import { formatShortDate } from '@/lib/dates';
import { formatPaise, rupeesToPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

import { categoryIcon } from '../category-icon';
import { categoryText } from '../labels';
import type { RequestFormValues } from '../schema';
import { formatGrams, kgToGrams } from '../weight';

type Props = {
  values: RequestFormValues;
  categories: Category[];
  cities: City[];
  feeBps?: number;
  saving: boolean;
  saveError?: string;
  onBack: () => void;
  onPost: () => void;
};

/** Step 3: what the requester will pay once they accept an offer at this fare. */
export function ReviewStep({
  values,
  categories,
  cities,
  feeBps,
  saving,
  saveError,
  onBack,
  onPost,
}: Props) {
  const category = categories.find((c) => c.id === values.categoryId);
  const city = (id: string) => cities.find((c) => String(c.id) === id)?.name ?? '';
  const item = rupeesToPaise(values.itemPriceRupees) ?? 0;
  const fare = rupeesToPaise(values.budgetRupees) ?? 0;
  const fee = platformFee(fare, feeBps);
  const grams = kgToGrams(values.weightKg);

  return (
    <Screen footer={<Button title={t('newRequest.post')} loading={saving} onPress={onPost} />}>
      <ScreenHeader
        title={t('newRequest.step3Title')}
        right={t('common.stepOf', { n: 3, total: 3 })}
        onBack={onBack}
      />
      <ProgressBar value={1} />

      <Card style={styles.group}>
        <View style={styles.row}>
          <IconTile name={categoryIcon(values.categoryId)} tone="teal" size={64} />
          <View style={styles.flex}>
            <Text variant="heading">{values.itemName}</Text>
            <Text variant="caption" muted>
              {[
                grams !== null ? formatGrams(grams) : '',
                category ? categoryText(category).name : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <View style={styles.route}>
          <Text variant="bodyStrong">{city(values.fromCityId)}</Text>
          <RouteArc />
          <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {city(values.toCityId)}
          </Text>
          <Text variant="caption" muted>
            {t('newRequest.byDate', { date: formatShortDate(values.deadline) })}
          </Text>
        </View>
      </Card>

      <Card>
        <MoneyRows
          rows={[
            { label: t('newRequest.itemPriceToTraveler'), value: formatPaise(item), strong: true },
            { label: t('newRequest.carryFareRow'), value: formatPaise(fare), strong: true },
            { label: t('newRequest.fee'), value: formatPaise(fee), strong: true },
          ]}
          total={{ label: t('newRequest.youPay'), value: formatPaise(item + fare + fee) }}
        />
      </Card>

      <InfoBox icon="shield">{t('newRequest.nothingCharged')}</InfoBox>

      {saveError ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  error: { color: colors.danger },
});
