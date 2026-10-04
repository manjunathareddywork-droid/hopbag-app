import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { VerifiedBadge } from '@/components/verified-badge';
import { t, type StringKey } from '@/i18n';
import { RatingBadge } from '@/features/ratings/rating-badge';
import type { RatingSummary } from '@/features/ratings/api';
import type { Offer, Profile } from '@/lib/database.types';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

type Props = {
  offer: Offer;
  traveler: Profile | undefined;
  rating?: RatingSummary;
  /** Show Accept/Decline (requester, offer pending, request still taking offers). */
  canRespond: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/** An offer as the requester sees it: who, when, how, and the fare. Never the PNR. */
export function OfferCard({
  offer,
  traveler,
  rating,
  canRespond,
  busy,
  onAccept,
  onDecline,
}: Props) {
  return (
    <View style={[styles.card, offer.status === 'accepted' && styles.accepted]}>
      <View style={styles.top}>
        <Text variant="label" style={styles.name}>
          {traveler?.full_name ?? ''}
        </Text>
        <Text variant="heading">{formatPaise(offer.fare_paise)}</Text>
      </View>
      <RatingBadge summary={rating} />
      {traveler?.traveler_verified_at ? (
        <View style={styles.badge}>
          <VerifiedBadge />
        </View>
      ) : null}
      <Text variant="body" muted>
        {t('offers.travelsOn', {
          mode: t(`travelModes.${offer.mode}` as StringKey),
          date: formatDate(offer.travel_date),
        })}
      </Text>
      {offer.message ? <Text variant="body">{`“${offer.message}”`}</Text> : null}
      {offer.status !== 'pending' ? (
        <Text variant="caption" muted>
          {t(`offers.status.${offer.status}` as StringKey)}
        </Text>
      ) : null}
      {canRespond && offer.status === 'pending' ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button title={t('offers.accept')} loading={busy} onPress={onAccept} />
          </View>
          <View style={styles.action}>
            <Button
              title={t('offers.decline')}
              variant="secondary"
              disabled={busy}
              onPress={onDecline}
            />
          </View>
        </View>
      ) : null}
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
    gap: spacing.sm,
  },
  accepted: {
    borderColor: colors.teal,
    borderWidth: 2,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
  badge: {
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
