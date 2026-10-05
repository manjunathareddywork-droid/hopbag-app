import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChoiceChip } from '@/components/choice';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useMyPayouts } from '@/features/delivery/hooks';
import { useOffersForRequest } from '@/features/offers/hooks';
import { usePaymentForRequest } from '@/features/payments/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useMyRating, useRate } from '@/features/ratings/hooks';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import type { RatingTag } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatPaise } from '@/lib/money';
import { colors, fonts, radius, spacing } from '@/theme';

/** Tags that fit each side: rating a traveler, or rating a requester. */
const TRAVELER_TAGS: RatingTag[] = ['on_time', 'great_shape', 'easy_to_talk'];
const REQUESTER_TAGS: RatingTag[] = ['clear_details', 'friendly', 'on_time'];

/** Delivery finished: the money is released; rate the other person once. */
export default function DeliveredScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const me = useSession().session?.user.id;
  const request = useRequest(requestId).data;
  const payment = usePaymentForRequest(requestId).data;
  const payout = useMyPayouts().data?.find((p) => p.request_id === requestId);
  const offer = useOffersForRequest(requestId).data?.find(
    (o) => o.id === request?.accepted_offer_id,
  );
  const iAmRequester = !!request && request.requester_id === me;
  const otherId = iAmRequester ? offer?.traveler_id : request?.requester_id;
  const other = useProfilesByIds(otherId ? [otherId] : []).data?.[0];
  const mine = useMyRating(requestId);
  const rate = useRate();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [note, setNote] = useState('');

  const name = firstName(other?.full_name);
  const item = request?.item_name ?? '';
  const home = () => router.dismissTo('/');
  const choices = iAmRequester ? TRAVELER_TAGS : REQUESTER_TAGS;

  function toggle(tag: RatingTag) {
    setTags((list) => (list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]));
  }

  const rated = !!mine.data || rate.isSuccess;

  return (
    <Screen
      footer={
        rated ? (
          <Button title={t('checking.backHome')} onPress={home} />
        ) : (
          <>
            {rate.error ? (
              <Text variant="caption" style={styles.error}>
                {dbErrorMessage(rate.error, 'ratings.failed')}
              </Text>
            ) : null}
            <Button
              title={t('delivered.submit')}
              disabled={stars === 0 || mine.isPending}
              loading={rate.isPending}
              onPress={() => rate.mutate({ requestId, stars, comment: note.trim(), tags })}
            />
            <Button title={t('common.skip')} variant="link" onPress={home} />
          </>
        )
      }
    >
      <View style={styles.top}>
        <View style={styles.circle}>
          <Icon name="check" size={44} color={colors.orange} />
        </View>
        <Text variant="display">{t('delivered.title')}</Text>
        <Text variant="body" muted style={styles.center}>
          {iAmRequester
            ? t('delivered.body', {
                amount: payment ? formatPaise(payment.amount_paise) : '',
                name,
                item,
              })
            : t('delivered.bodyTraveler', {
                item,
                amount: payout ? formatPaise(payout.net_paise) : '',
              })}
        </Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar name={other?.full_name} size={48} />
          <Text variant="bodyStrong">{t('delivered.howWas', { name })}</Text>
        </View>
        {rated ? (
          <Text variant="body" muted>
            {t('ratings.youRated', { stars: mine.data?.stars ?? stars })}
          </Text>
        ) : (
          <>
            <View style={styles.stars} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={t('ratings.starsLabel', { stars: n })}
                  accessibilityState={{ selected: stars === n }}
                  onPress={() => setStars(n)}
                  hitSlop={6}
                >
                  {/* Orange fill is a shape; the outline keeps it visible on white. */}
                  <Icon
                    name={n <= stars ? 'starFilled' : 'starEmpty'}
                    size={44}
                    color={n <= stars ? colors.orange : colors.teal}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.tags}>
              {choices.map((tag) => (
                <ChoiceChip
                  key={tag}
                  label={t(`delivered.tags.${tag}`)}
                  selected={tags.includes(tag)}
                  onPress={() => toggle(tag)}
                />
              ))}
            </View>
            <TextInput
              accessibilityLabel={t('delivered.note')}
              placeholder={t('delivered.note')}
              placeholderTextColor={colors.textSubtle}
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              style={styles.note}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  note: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, textAlign: 'center' },
});
