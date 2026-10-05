import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { Text } from '@/components/text';
import { useFeed } from '@/features/offers/hooks';
import { useCategories } from '@/features/requests/hooks';
import { categoryIcon } from '@/features/requests/category-icon';
import { formatGrams } from '@/features/requests/weight';
import { useProfilesByIds } from '@/features/profile/hooks';
import { shortName } from '@/features/profile/name';
import { t } from '@/i18n';
import { formatShortDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { fonts, spacing } from '@/theme';

const TONES = ['teal', 'orange', 'tealTint'] as const;

/** Open requests that fit one of my trips ("Requests on this route"). */
export function RouteRequests({ tripId }: { tripId: string }) {
  const router = useRouter();
  const feed = useFeed(tripId);
  useCategories();
  const list = (feed.data ?? []).filter((r) => r.my_offer_status !== 'withdrawn');
  const people = useProfilesByIds(list.map((r) => r.requester_id));

  return (
    <View style={styles.list}>
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          {t('tripsTab.requestsOnRoute')}
        </Text>
        {list.length > 0 ? (
          <Text variant="caption" muted>
            {t('tripsTab.openCount', { count: list.length })}
          </Text>
        ) : null}
      </View>
      {feed.isSuccess && list.length === 0 ? (
        <Text variant="body" muted>
          {t('tripsTab.noRequests')}
        </Text>
      ) : null}
      {feed.isError ? (
        <Text variant="body" muted>
          {t('common.networkError')}
        </Text>
      ) : null}
      {list.map((r, i) => (
        <Card
          key={r.id}
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/traveler/requests/[id]', params: { id: r.id, tripId } })
          }
        >
          <IconTile name={categoryIcon(r.category_id)} tone={TONES[i % TONES.length]} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {r.item_name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {t('tripsTab.requestLine', {
                weight: formatGrams(r.weight_grams),
                name: shortName(people.data?.find((p) => p.id === r.requester_id)?.full_name),
                date: formatShortDate(r.deadline),
              })}
            </Text>
          </View>
          <View style={styles.price}>
            <Text style={styles.amount}>{formatPaise(r.budget_paise)}</Text>
            <Text variant="caption" muted>
              {r.my_offer_status ? t(`offers.status.${r.my_offer_status}`) : t('offerList.fare')}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md - 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  price: { alignItems: 'flex-end' },
  amount: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24 },
});
