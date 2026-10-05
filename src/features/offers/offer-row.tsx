import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Text } from '@/components/text';
import { useProfileStats } from '@/features/profile/hooks';
import { t } from '@/i18n';
import type { Offer } from '@/lib/database.types';
import { formatDay } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { fonts, spacing } from '@/theme';

type Props = {
  offer: Offer;
  name: string;
  best: boolean;
  onPress: () => void;
};

/** One traveler's offer in the requester's list. */
export function OfferRow({ offer, name, best, onPress }: Props) {
  const stats = useProfileStats(offer.traveler_id).data;
  const lands = formatDay(offer.travel_date);
  const line =
    stats?.rating != null
      ? t('offerList.ratingLine', {
          rating: stats.rating.toFixed(1),
          trips: stats.deliveries,
          date: lands,
        })
      : t('offerList.newTraveler', { date: lands });

  return (
    <Card
      onPress={onPress}
      tone={best ? 'selected' : 'default'}
      accessibilityLabel={`${name}, ${formatPaise(offer.fare_paise)}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <Avatar name={name} size={56} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{name}</Text>
          <Text variant="caption" muted>
            {line}
          </Text>
        </View>
        <View style={styles.price}>
          <Text style={styles.amount}>{formatPaise(offer.fare_paise)}</Text>
          <Text variant="caption" muted>
            {t('offerList.fare')}
          </Text>
        </View>
      </View>
      <View style={styles.badges}>
        <Badge label={t('offerList.ticketVerified')} tone="green" />
        {best ? <Badge label={t('offerList.bestMatch')} tone="peach" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md - 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  price: { alignItems: 'flex-end' },
  amount: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  badges: { flexDirection: 'row', gap: spacing.sm },
});
