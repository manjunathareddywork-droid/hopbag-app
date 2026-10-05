import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { LoadingView } from '@/components/loading-view';
import { ProgressBar } from '@/components/progress';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useOffersForRequests } from '@/features/offers/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { shortName } from '@/features/profile/name';
import { useMyRequests } from '@/features/requests/hooks';
import { t, type StringKey } from '@/i18n';
import type { ItemRequest, Offer, RequestStatus } from '@/lib/database.types';
import { formatDay, formatShortDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { spacing } from '@/theme';

type Tab = 'active' | 'delivered' | 'cancelled';

const TAB_OF: Record<RequestStatus, Tab> = {
  draft: 'active',
  open: 'active',
  offered: 'active',
  accepted: 'active',
  paid: 'active',
  picked_up: 'active',
  delivered: 'active',
  disputed: 'active',
  settled: 'delivered',
  cancelled: 'cancelled',
  expired: 'cancelled',
  refunded: 'cancelled',
};

const IN_TRANSIT: RequestStatus[] = ['paid', 'picked_up', 'delivered'];
const PROGRESS: Partial<Record<RequestStatus, number>> = {
  paid: 0.3,
  picked_up: 0.65,
  delivered: 0.9,
};

export default function MyRequestsScreen() {
  const router = useRouter();
  const requests = useMyRequests();
  const cities = useCities();
  const [tab, setTab] = useState<Tab>('active');
  const offers = useOffersForRequests((requests.data ?? []).map((r) => r.id));
  const travelers = useProfilesByIds((offers.data ?? []).map((o) => o.traveler_id));

  if (!requests.data || !cities.data) {
    return (
      <LoadingView
        error={requests.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          requests.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const cityName = (id: number) => cities.data.find((c) => c.id === id)?.name ?? '';
  const shown = requests.data.filter((r) => TAB_OF[r.status] === tab);
  const offersOn = (r: ItemRequest) => (offers.data ?? []).filter((o) => o.request_id === r.id);

  return (
    <Screen inTabs>
      <Text variant="title" style={styles.title}>
        {t('myRequests.title')}
      </Text>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: t('myRequests.active') },
          { value: 'delivered', label: t('myRequests.delivered') },
          { value: 'cancelled', label: t('myRequests.cancelled') },
        ]}
      />
      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" muted style={styles.center}>
            {t(`myRequests.empty${tab[0].toUpperCase()}${tab.slice(1)}` as StringKey)}
          </Text>
          {tab === 'active' ? (
            <Button title={t('homeScreen.ask')} onPress={() => router.push('/requests/new')} />
          ) : null}
        </View>
      ) : null}
      {shown.map((r) => (
        <RequestRow
          key={r.id}
          request={r}
          offers={offersOn(r)}
          route={t('myRequests.routeLine', {
            from: cityName(r.from_city_id),
            to: cityName(r.to_city_id),
            date: formatShortDate(r.deadline),
          })}
          travelerName={(o) =>
            shortName(travelers.data?.find((p) => p.id === o.traveler_id)?.full_name)
          }
          onPress={() => router.push({ pathname: '/requests/[id]', params: { id: r.id } })}
        />
      ))}
    </Screen>
  );
}

function RequestRow({
  request: r,
  offers,
  route,
  travelerName,
  onPress,
}: {
  request: ItemRequest;
  offers: Offer[];
  route: string;
  travelerName: (o: Offer) => string;
  onPress: () => void;
}) {
  const pending = offers.filter((o) => o.status === 'pending');
  const accepted = offers.find((o) => o.id === r.accepted_offer_id);
  const inTransit = IN_TRANSIT.includes(r.status);

  let badge: { label: string; tone: BadgeTone };
  if (inTransit) badge = { label: t('myRequests.inTransit'), tone: 'blue' };
  else if (r.status === 'offered' && pending.length > 0) {
    badge = {
      label:
        pending.length === 1
          ? t('myRequests.oneOffer')
          : t('myRequests.offers', { count: pending.length }),
      tone: 'peach',
    };
  } else if (r.status === 'open') badge = { label: t('myRequests.open'), tone: 'grey' };
  else if (r.status === 'settled') badge = { label: t('status.settled'), tone: 'green' };
  else if (r.status === 'disputed') badge = { label: t('status.disputed'), tone: 'peach' };
  else badge = { label: t(`status.${r.status}` as StringKey), tone: 'grey' };

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text variant="heading" style={styles.flex} numberOfLines={2}>
          {r.item_name}
        </Text>
        <Badge {...badge} />
      </View>
      <Text variant="caption" muted>
        {route}
      </Text>
      {inTransit ? (
        <>
          <ProgressBar value={PROGRESS[r.status] ?? 0} tone="teal" />
          {accepted ? (
            <Text variant="caption" muted>
              {t('myRequests.withTraveler', {
                name: travelerName(accepted),
                status: t('paidScreen.arriving', { date: formatDay(accepted.travel_date) }),
              })}
            </Text>
          ) : null}
        </>
      ) : r.status === 'open' ? (
        <Text variant="caption" muted>
          {t('myRequests.noOffers')}
        </Text>
      ) : r.status === 'offered' || r.status === 'accepted' ? (
        <View style={styles.row}>
          <Text variant="body" muted style={styles.flex}>
            {t('myRequests.fareYouSet')}
          </Text>
          <Text variant="bodyStrong">{formatPaise(r.budget_paise)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  empty: { gap: spacing.lg, paddingVertical: spacing.xl },
  center: { textAlign: 'center' },
});
