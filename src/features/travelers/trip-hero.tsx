import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { RouteLine } from '@/components/route-line';
import { Text } from '@/components/text';
import { formatGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import type { Trip } from '@/lib/database.types';
import { formatDay } from '@/lib/dates';
import { colors, spacing } from '@/theme';

import type { TripLoad } from './trip-load';

/** Teal card for a trip: date, route, space left and ticket review state. */
export function TripHero({
  trip,
  from,
  to,
  load,
  label,
  onPress,
}: {
  trip: Trip;
  from: string;
  to: string;
  load: TripLoad | undefined;
  label?: string;
  onPress?: () => void;
}) {
  const used = load ?? { items: 0, grams: 0 };
  return (
    <Card tone="dark" style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        {label ? <Badge label={label} tone="orange" /> : <View />}
        <Text variant="caption" style={styles.muted}>
          {formatDay(trip.travel_date)}
        </Text>
      </View>
      <RouteLine from={from} to={to} light size="lg" />
      <Text variant="caption" style={styles.muted}>
        {t('tripsTab.freeLine', {
          free: formatGrams(Math.max(trip.capacity_grams - used.grams, 0)),
          taken: used.items,
          max: trip.max_items,
        })}
      </Text>
      {trip.ticket_status === 'pending' ? (
        <Badge label={t('tripsTab.ticketInReview')} tone="peach" />
      ) : trip.ticket_status === 'rejected' ? (
        <Badge label={t('tripsTab.ticketRejected')} tone="peach" />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm + 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.textOnDarkMuted },
});
