import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { LoadingView } from '@/components/loading-view';
import { MoneyRows } from '@/components/money-rows';
import { RouteLine } from '@/components/route-line';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Stat } from '@/components/stat';
import { Text } from '@/components/text';
import { useAcceptOffer, useDeclineOffer, useOffersForRequest } from '@/features/offers/hooks';
import { platformFee } from '@/features/payments/fee';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds, useProfileStats } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { useSettings } from '@/features/travelers/hooks';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDay } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, spacing } from '@/theme';

/** One traveler's offer: who they are, their trip, and what the requester will pay. */
export default function OfferScreen() {
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId: string }>();
  const router = useRouter();
  const request = useRequest(requestId);
  const offers = useOffersForRequest(requestId);
  const offer = offers.data?.find((o) => o.id === id);
  const traveler = useProfilesByIds(offer ? [offer.traveler_id] : []).data?.[0];
  const stats = useProfileStats(offer?.traveler_id).data;
  const cities = useCities();
  const settings = useSettings();
  const accept = useAcceptOffer();
  const decline = useDeclineOffer();
  const [confirmDecline, setConfirmDecline] = useState(false);

  if (!request.data || !offers.data || !cities.data) {
    const failed = request.isError || offers.isError || cities.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          offers.refetch();
        }}
      />
    );
  }
  if (!offer) return <LoadingView error={t('errors.notFound')} />;

  const r = request.data;
  const cityName = (cityId: number | null | undefined) =>
    cities.data.find((c) => c.id === cityId)?.name ?? '';
  const name = traveler?.full_name ?? stats?.full_name ?? '';
  const item = r.item_price_paise ?? 0;
  const fee = platformFee(offer.fare_paise, settings.data?.platform_fee_bps);
  const total = item + offer.fare_paise + fee;
  const months = t('common.monthsShort').split(',');
  const joined = stats ? new Date(stats.joined_at) : null;
  const canAccept = r.status === 'offered' && offer.status === 'pending';
  const isAccepted = r.status === 'accepted' && r.accepted_offer_id === offer.id;
  const error = accept.error ?? decline.error;

  function acceptAndPay() {
    accept.mutate(offer!.id, {
      onSuccess: () =>
        router.replace({ pathname: '/pay/[requestId]', params: { requestId: r.id } }),
    });
  }

  return (
    <Screen
      footer={
        canAccept || isAccepted ? (
          <>
            {error ? (
              <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
                {dbErrorMessage(error, 'offers.actionFailed')}
              </Text>
            ) : null}
            <Button
              title={t('offerDetail.acceptAndPay', { amount: formatPaise(total) })}
              loading={accept.isPending}
              onPress={
                isAccepted
                  ? () => router.push({ pathname: '/pay/[requestId]', params: { requestId: r.id } })
                  : acceptAndPay
              }
            />
            {canAccept ? (
              confirmDecline ? (
                <Button
                  title={t('offers.declineYes')}
                  variant="dangerLink"
                  loading={decline.isPending}
                  onPress={() => decline.mutate(offer.id, { onSuccess: () => router.back() })}
                />
              ) : (
                <Button
                  title={t('offerDetail.decline')}
                  variant="link"
                  onPress={() => setConfirmDecline(true)}
                />
              )
            ) : null}
          </>
        ) : null
      }
    >
      <ScreenHeader title={t('offerDetail.title', { name: firstName(name) })} />

      <Card style={styles.profile}>
        <Avatar name={name} size={88} />
        <Text variant="screenTitle">{name}</Text>
        <Text variant="caption" muted>
          {joined
            ? t('offerDetail.joined', {
                city: cityName(stats?.home_city_id),
                month: `${months[joined.getMonth()]} ${joined.getFullYear()}`,
              })
            : ''}
        </Text>
        <View style={styles.badges}>
          {stats?.verified ? <Badge label={t('offerDetail.idVerified')} tone="green" /> : null}
          <Badge label={t('offerList.ticketVerified')} tone="green" />
        </View>
        <View style={styles.stats}>
          <Stat
            value={stats?.rating != null ? stats.rating.toFixed(1) : '–'}
            label={t('offerDetail.rating')}
          />
          <Stat value={String(stats?.deliveries ?? 0)} label={t('offerDetail.deliveries')} />
          <Stat value={String(stats?.disputes ?? 0)} label={t('offerDetail.disputes')} />
        </View>
      </Card>

      <Card style={styles.group}>
        <Text variant="bodyStrong">{t('offerDetail.trip')}</Text>
        <RouteLine from={cityName(r.from_city_id)} to={cityName(r.to_city_id)} />
        <Text variant="caption" muted>
          {t('offerDetail.travels', {
            mode: t(`travelModes.${offer.mode}` as StringKey),
            date: formatDay(offer.travel_date),
          })}
        </Text>
        {offer.message ? (
          <Text variant="body" style={styles.message}>
            {`“${offer.message}”`}
          </Text>
        ) : null}
      </Card>

      <Card>
        <MoneyRows
          rows={[
            {
              label: t('offerDetail.carryFare'),
              value: formatPaise(offer.fare_paise),
              strong: true,
            },
            { label: t('offerDetail.itemPrice'), value: formatPaise(item) },
            { label: t('offerDetail.fee'), value: formatPaise(fee) },
          ]}
          total={{ label: t('offerDetail.total'), value: formatPaise(total) }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  group: { gap: spacing.sm },
  message: { fontStyle: 'italic' },
  error: { color: colors.danger, textAlign: 'center' },
});
