import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { MoneyRows } from '@/components/money-rows';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { Timeline, type TimelineStep } from '@/components/timeline';
import { formatIndianPhone } from '@/features/auth/phone';
import { useCounterpartPhone } from '@/features/chat/hooks';
import { DisputeNotice } from '@/features/delivery/dispute-notice';
import { useDelivery, useDispute, usePickupPhotoUrl } from '@/features/delivery/hooks';
import { RouteProgress } from '@/features/delivery/route-progress';
import { rankOffers } from '@/features/offers/best-match';
import { useOffersForRequest } from '@/features/offers/hooks';
import { OfferRow } from '@/features/offers/offer-row';
import { platformFee } from '@/features/payments/fee';
import { usePaymentForRequest, useRefundPayment } from '@/features/payments/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRatingSummaries } from '@/features/ratings/hooks';
import { useCancelRequest, useRequest } from '@/features/requests/hooks';
import { RequestHero } from '@/features/requests/request-hero';
import { useSettings } from '@/features/travelers/hooks';
import { t, type StringKey } from '@/i18n';
import type { ItemRequest, Offer, Profile } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDay, formatShortDate, formatStamp } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

const CANCELLABLE = ['draft', 'open', 'offered', 'accepted'];
const TRACKING = ['paid', 'picked_up', 'delivered', 'disputed', 'settled'];

/** The requester's view of one request: offers, then payment, then tracking. */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequest(id);
  const cities = useCities();
  const offers = useOffersForRequest(id);
  const travelers = useProfilesByIds((offers.data ?? []).map((o) => o.traveler_id));

  if (request.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!request.data || !cities.data) {
    return (
      <LoadingView
        error={request.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const r = request.data;
  const cityName = (cityId: number) => cities.data.find((c) => c.id === cityId)?.name ?? '';
  const accepted = (offers.data ?? []).find((o) => o.id === r.accepted_offer_id);
  const traveler = travelers.data?.find((p) => p.id === accepted?.traveler_id);

  if (TRACKING.includes(r.status) && accepted) {
    return (
      <Tracking
        request={r}
        offer={accepted}
        traveler={traveler}
        from={cityName(r.from_city_id)}
        to={cityName(r.to_city_id)}
      />
    );
  }
  return (
    <OffersView
      request={r}
      offers={offers.data ?? []}
      travelers={travelers.data ?? []}
      from={cityName(r.from_city_id)}
      to={cityName(r.to_city_id)}
    />
  );
}

function OffersView({
  request: r,
  offers,
  travelers,
  from,
  to,
}: {
  request: ItemRequest;
  offers: Offer[];
  travelers: Profile[];
  from: string;
  to: string;
}) {
  const router = useRouter();
  const cancel = useCancelRequest();
  const settings = useSettings();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pending = offers.filter((o) => o.status === 'pending');
  const ratings = useRatingSummaries(pending.map((o) => o.traveler_id));
  const ranked = rankOffers(
    pending.map((offer) => ({
      offer,
      rating: ratings.data?.find((s) => s.user_id === offer.traveler_id)?.average ?? null,
    })),
  );
  const accepted = offers.find((o) => o.id === r.accepted_offer_id);
  const nameOf = (o: Offer) => travelers.find((p) => p.id === o.traveler_id)?.full_name ?? '';
  const takingOffers = r.status === 'open' || r.status === 'offered';
  const ended = ['cancelled', 'expired', 'refunded'].includes(r.status);

  const badge = takingOffers ? t('myRequests.open') : t(`status.${r.status}` as StringKey);

  let footer: React.ReactNode = null;
  if (r.status === 'accepted' && accepted && r.item_price_paise !== null) {
    const fee = platformFee(accepted.fare_paise, settings.data?.platform_fee_bps);
    const total = r.item_price_paise + accepted.fare_paise + fee;
    footer = (
      <Button
        title={t('offerDetail.acceptAndPay', { amount: formatPaise(total) })}
        onPress={() => router.push({ pathname: '/pay/[requestId]', params: { requestId: r.id } })}
      />
    );
  }

  return (
    <Screen footer={footer}>
      <ScreenHeader title={t('offerList.title')} />
      <RequestHero
        title={r.item_name}
        badge={badge}
        from={from}
        to={to}
        after={t('newRequest.byDate', { date: formatShortDate(r.deadline) })}
      />

      {r.status === 'accepted' && accepted ? (
        <>
          <Text variant="heading">{t('offers.chosen')}</Text>
          <OfferRow
            offer={accepted}
            name={nameOf(accepted)}
            best={false}
            onPress={() =>
              router.push({
                pathname: '/offers/[id]',
                params: { id: accepted.id, requestId: r.id },
              })
            }
          />
        </>
      ) : null}

      {takingOffers ? (
        <>
          <View style={styles.listHead}>
            <Text variant="heading" style={styles.flex}>
              {ranked.length === 1
                ? t('offerList.one')
                : t('offerList.count', { count: ranked.length })}
            </Text>
            {ranked.length > 1 ? (
              <Text variant="caption" muted>
                {t('offerList.sorted')}
              </Text>
            ) : null}
          </View>
          {ranked.length === 0 ? (
            <InfoBox tone="neutral" icon="clock">
              {t('offerList.waiting')}
            </InfoBox>
          ) : null}
          {ranked.map(({ offer }, i) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              name={nameOf(offer)}
              best={i === 0 && ranked.length > 1}
              onPress={() =>
                router.push({ pathname: '/offers/[id]', params: { id: offer.id, requestId: r.id } })
              }
            />
          ))}
        </>
      ) : null}

      {ended ? (
        <InfoBox tone="neutral" icon="info">
          {t(`status.${r.status}` as StringKey)}
        </InfoBox>
      ) : null}

      {CANCELLABLE.includes(r.status) ? (
        <View style={styles.cancel}>
          {cancel.error ? (
            <Text variant="caption" style={styles.error}>
              {dbErrorMessage(cancel.error, 'requests.cancelFailed')}
            </Text>
          ) : null}
          {confirmCancel ? (
            <Card style={styles.confirm}>
              <Text variant="body">{t('requests.cancelConfirm')}</Text>
              <Button
                title={t('requests.cancelYes')}
                variant="outline"
                loading={cancel.isPending}
                onPress={() => cancel.mutate(r.id)}
              />
              <Button
                title={t('requests.keep')}
                variant="link"
                onPress={() => setConfirmCancel(false)}
              />
            </Card>
          ) : (
            <Button
              title={t('requests.cancelRequest')}
              variant="dangerLink"
              onPress={() => setConfirmCancel(true)}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Tracking({
  request: r,
  offer,
  traveler,
  from,
  to,
}: {
  request: ItemRequest;
  offer: Offer;
  traveler: Profile | undefined;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const delivery = useDelivery(r.id).data;
  const dispute = useDispute(r.id).data;
  const payment = usePaymentForRequest(r.id).data;
  const refund = useRefundPayment();
  const photo = usePickupPhotoUrl(delivery?.pickup_photo_path).data;
  const rating = useRatingSummaries([offer.traveler_id]).data?.[0];
  const phone = useCounterpartPhone(r.id, r.status !== 'settled').data;
  const [confirmRefund, setConfirmRefund] = useState(false);
  const name = traveler?.full_name ?? '';
  const mode = t(`travelModes.${offer.mode}` as StringKey);

  const pickedUp = !!delivery;
  const handedOver = r.status === 'delivered' || r.status === 'settled';
  const steps: TimelineStep[] = [
    {
      title: t('tracking.paidHeld'),
      detail: payment?.captured_at ? formatStamp(payment.captured_at) : undefined,
      state: 'done',
    },
    {
      title: pickedUp
        ? t('tracking.pickedUp', { city: from })
        : t('tracking.waitingPickup', { city: from }),
      detail: delivery
        ? `${formatStamp(delivery.picked_up_at)} · ${t('tracking.photoAdded')}`
        : t('paidScreen.chatAnyTime'),
      state: pickedUp ? 'done' : 'current',
    },
    {
      title: t('tracking.onTheWay', { city: to }),
      detail: t('tracking.travels', { mode, date: formatDay(offer.travel_date) }),
      state: handedOver ? 'done' : pickedUp ? 'current' : 'todo',
    },
    {
      title:
        r.status === 'delivered' && delivery?.delivery_method === 'handover'
          ? t('tracking.handedOver')
          : t('tracking.deliveredWithCode'),
      detail:
        r.status === 'delivered' && delivery?.confirm_by
          ? t('tracking.confirmBy', { deadline: formatStamp(delivery.confirm_by) })
          : undefined,
      state: r.status === 'settled' ? 'done' : r.status === 'delivered' ? 'current' : 'todo',
    },
  ];
  const progress = r.status === 'settled' ? 1 : handedOver ? 0.9 : pickedUp ? 0.55 : 0.12;
  const badge =
    r.status === 'settled'
      ? t('tracking.completed')
      : r.status === 'disputed'
        ? t('status.disputed')
        : pickedUp
          ? t('myRequests.inTransit')
          : t('status.paid');

  let footer: React.ReactNode;
  if (r.status === 'settled') {
    footer = (
      <Button
        title={t('delivered.howWas', { name: firstName(name) })}
        onPress={() =>
          router.push({ pathname: '/delivered/[requestId]', params: { requestId: r.id } })
        }
      />
    );
  } else if (r.status === 'disputed') {
    footer = null;
  } else if (r.status === 'paid') {
    footer = (
      <>
        {refund.error ? (
          <Text variant="caption" style={styles.error}>
            {dbErrorMessage(refund.error, 'payment.refundFailed')}
          </Text>
        ) : null}
        {confirmRefund ? (
          <Button
            title={t('payment.refundYes')}
            variant="outline"
            loading={refund.isPending}
            onPress={() => refund.mutate(r.id)}
          />
        ) : (
          <Button
            title={t('tracking.cancelRefund')}
            variant="outline"
            onPress={() => setConfirmRefund(true)}
          />
        )}
        <Button
          title={t('tracking.somethingWrong')}
          variant="link"
          onPress={() =>
            router.push({ pathname: '/dispute/[requestId]', params: { requestId: r.id } })
          }
        />
      </>
    );
  } else {
    footer = (
      <>
        <Button
          title={t('tracking.showCode')}
          onPress={() =>
            router.push({ pathname: '/handover-code/[requestId]', params: { requestId: r.id } })
          }
        />
        <Button
          title={t('tracking.somethingWrong')}
          variant="link"
          onPress={() =>
            router.push({ pathname: '/dispute/[requestId]', params: { requestId: r.id } })
          }
        />
      </>
    );
  }

  return (
    <Screen footer={footer}>
      <ScreenHeader title={t('tracking.title')} />
      <Card tone="dark" style={styles.hero}>
        <View style={styles.row}>
          <Text variant="heading" style={[styles.light, styles.flex]}>
            {r.item_name}
          </Text>
          <Badge label={badge} tone="orange" />
        </View>
        <RouteProgress value={progress} />
        <View style={styles.row}>
          <Text variant="caption" style={[styles.lightMuted, styles.flex]}>
            {from}
          </Text>
          <Text variant="caption" style={styles.lightMuted}>
            {t('tracking.arrives', { date: formatDay(offer.travel_date), city: to })}
          </Text>
        </View>
      </Card>

      <Card style={styles.row}>
        <Avatar name={name} size={56} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{name}</Text>
          <Text variant="caption" muted>
            {rating
              ? t('tracking.yourTraveler', { rating: rating.average.toFixed(1) })
              : t('tracking.yourTravelerNew')}
          </Text>
          {phone ? (
            <Text variant="caption" muted>
              {t('tracking.phone', { phone: formatIndianPhone(phone) })}
            </Text>
          ) : null}
        </View>
        {r.status !== 'settled' ? (
          <IconButton
            icon="message-square"
            label={t('payScreen.message', { name: firstName(name) })}
            onPress={() =>
              router.push({ pathname: '/chat/[requestId]', params: { requestId: r.id } })
            }
          />
        ) : null}
      </Card>

      {dispute ? <DisputeNotice dispute={dispute} /> : null}

      <Card>
        <Timeline steps={steps} />
      </Card>

      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          contentFit="cover"
          accessibilityLabel={t('delivery.pickupPhoto')}
        />
      ) : null}

      {r.status === 'settled' && payment ? (
        <Card>
          <MoneyRows
            rows={[]}
            total={{ label: t('tracking.completed'), value: formatPaise(payment.amount_paise) }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancel: { gap: spacing.sm, marginTop: spacing.sm },
  confirm: { gap: spacing.sm },
  error: { color: colors.danger, textAlign: 'center' },
  hero: { gap: spacing.md },
  light: { color: colors.white },
  lightMuted: { color: colors.textOnDarkMuted },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
});
