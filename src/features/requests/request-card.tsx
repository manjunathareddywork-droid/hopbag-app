import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusChip } from '@/components/status-chip';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import type { City, ItemRequest } from '@/lib/database.types';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

type Props = {
  request: ItemRequest;
  cities: City[];
};

export function RequestCard({ request, cities }: Props) {
  const cityName = (id: number) => cities.find((c) => c.id === id)?.name ?? '';
  return (
    <Link href={{ pathname: '/requests/[id]', params: { id: request.id } }} asChild>
      <Pressable accessibilityRole="button" style={styles.card}>
        <View style={styles.top}>
          <Text variant="label" style={styles.name} numberOfLines={1}>
            {request.item_name}
          </Text>
          <Text variant="label">{formatPaise(request.budget_paise)}</Text>
        </View>
        <Text variant="body" muted>
          {t('requests.route', {
            from: cityName(request.from_city_id),
            to: cityName(request.to_city_id),
          })}
        </Text>
        <View style={styles.bottom}>
          <StatusChip status={request.status} />
          <Text variant="caption" muted>
            {formatDate(request.deadline)}
          </Text>
        </View>
      </Pressable>
    </Link>
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
    marginTop: spacing.xs,
  },
});
