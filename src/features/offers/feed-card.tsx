import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { categoryText } from '@/features/requests/labels';
import { formatGrams } from '@/features/requests/weight';
import { t, type StringKey } from '@/i18n';
import type { Category, City, FeedRequest } from '@/lib/database.types';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  request: FeedRequest;
  tripId: string;
  cities: City[];
  categories: Category[];
};

export function FeedCard({ request, tripId, cities, categories }: Props) {
  const cityName = (id: number) => cities.find((c) => c.id === id)?.name ?? '';
  const category = categories.find((c) => c.id === request.category_id);
  return (
    <Link
      href={{ pathname: '/traveler/requests/[id]', params: { id: request.id, tripId } }}
      asChild
    >
      <Pressable accessibilityRole="button" style={styles.card}>
        <View style={styles.top}>
          <Text variant="label" style={styles.name} numberOfLines={1}>
            {request.item_name}
          </Text>
          <Text variant="caption" muted>
            {formatGrams(request.weight_grams)}
          </Text>
        </View>
        <Text variant="body" muted>
          {`${category ? categoryText(category).name : request.category_id} · ${t(
            'requests.route',
            { from: cityName(request.from_city_id), to: cityName(request.to_city_id) },
          )}`}
        </Text>
        <Text variant="caption">
          {t('offers.fareRange', {
            min: formatPaise(request.fare_min_paise),
            max: formatPaise(request.fare_max_paise),
          })}
        </Text>
        <View style={styles.bottom}>
          <View style={styles.chips}>
            <Chip text={request.exact_match ? t('offers.sameCities') : t('offers.sameStates')} />
            {request.my_offer_status ? (
              <Chip text={t(`offers.status.${request.my_offer_status}` as StringKey)} strong />
            ) : null}
          </View>
          <Text variant="caption" muted>
            {t('offers.neededBy', { date: formatDate(request.deadline) })}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function Chip({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View style={[styles.chip, strong && styles.chipStrong]}>
      <Text variant="caption" style={[styles.chipText, strong && styles.chipTextStrong]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipStrong: {
    backgroundColor: colors.teal,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.medium,
  },
  chipTextStrong: {
    color: colors.textOnDark,
  },
});
