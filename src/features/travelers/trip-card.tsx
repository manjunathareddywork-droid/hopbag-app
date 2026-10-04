import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { t, type StringKey } from '@/i18n';
import type { City, Trip } from '@/lib/database.types';
import { formatDate } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  trip: Trip;
  cities: City[];
  href: '/traveler/trips/[id]' | '/admin/trips/[id]';
  subtitle?: string;
};

export function TripCard({ trip, cities, href, subtitle }: Props) {
  const cityName = (id: number) => cities.find((c) => c.id === id)?.name ?? '';
  const status =
    trip.status === 'active'
      ? t(`reviewStatus.${trip.ticket_status}` as StringKey)
      : t(`trips.status.${trip.status}` as StringKey);
  return (
    <Link href={{ pathname: href, params: { id: trip.id } }} asChild>
      <Pressable accessibilityRole="button" style={styles.card}>
        <Text variant="label">
          {t('trips.route', { from: cityName(trip.from_city_id), to: cityName(trip.to_city_id) })}
        </Text>
        {subtitle ? (
          <Text variant="body" muted>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.bottom}>
          <View style={[styles.chip, trip.ticket_status === 'rejected' && styles.chipAlert]}>
            <Text variant="caption" style={styles.chipText}>
              {`${t('trips.ticket')}: ${status}`}
            </Text>
          </View>
          <Text variant="caption" muted>
            {formatDate(trip.travel_date)}
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
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipAlert: {
    backgroundColor: colors.dangerSoft,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.medium,
  },
});
