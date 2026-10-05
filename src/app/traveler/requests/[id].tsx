import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { MoneyRows } from '@/components/money-rows';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { fareBand, validateFare } from '@/features/offers/fare';
import { useMakeOffer, useOffersForRequest, useWithdrawOffer } from '@/features/offers/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { shortName } from '@/features/profile/name';
import { categoryIcon } from '@/features/requests/category-icon';
import { useRequest, useRequestPhotoUrl } from '@/features/requests/hooks';
import { formatGrams } from '@/features/requests/weight';
import { useSettings } from '@/features/travelers/hooks';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatShortDate } from '@/lib/dates';
import { formatPaise, rupeesToPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

/** A request as a traveler sees it: make an offer, or follow the one they made. */
export default function TravelerRequestScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const router = useRouter();
  const request = useRequest(id);
  const offers = useOffersForRequest(id);
  const cities = useCities();
  const settings = useSettings();
  const photo = useRequestPhotoUrl(request.data?.photo_path);
  const requester = useProfilesByIds(request.data ? [request.data.requester_id] : []).data?.[0];
  const make = useMakeOffer();
  const withdraw = useWithdrawOffer();
  const [fare, setFare] = useState('');
  const [message, setMessage] = useState('');
  const [fareError, setFareError] = useState<string>();

  if (request.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!request.data || !cities.data || !offers.data || !settings.data) {
    const failed = request.isError || cities.isError || offers.isError || settings.isError;
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

  const r = request.data;
  // RLS shows a traveler only their own offers on this request; newest first.
  const mine = [...offers.data].reverse()[0];
  const chosen = mine?.status === 'accepted' && mine.id === r.accepted_offer_id;

  // Once chosen and paid, the delivery screens take over.
  if (chosen && r.status === 'paid') {
    return (
      <Redirect href={{ pathname: '/traveler/pickup/[requestId]', params: { requestId: r.id } }} />
    );
  }
  if (chosen && (r.status === 'picked_up' || r.status === 'delivered' || r.status === 'disputed')) {
    return (
      <Redirect href={{ pathname: '/traveler/deliver/[requestId]', params: { requestId: r.id } }} />
    );
  }
  if (chosen && r.status === 'settled') {
    return <Redirect href={{ pathname: '/delivered/[requestId]', params: { requestId: r.id } }} />;
  }

  const cityName = (cityId: number | null | undefined) =>
    cities.data.find((c) => c.id === cityId)?.name ?? '';
  const band = fareBand(r.weight_grams, settings.data);
  const item = r.item_price_paise ?? 0;
  const open = r.status === 'open' || r.status === 'offered';
  const canOffer = open && !!tripId && (!mine || mine.status === 'withdrawn');
  const farePaise = rupeesToPaise(fare);

  function send() {
    const problem = validateFare(fare, band.minPaise, band.maxPaise);
    setFareError(problem ?? undefined);
    if (problem) return;
    make.mutate(
      { requestId: r.id, tripId: tripId!, farePaise: farePaise!, message: message.trim() },
      {
        onSuccess: () =>
          router.replace({
            pathname: '/traveler/offer-sent',
            params: { requestId: r.id, fare: String(farePaise) },
          }),
      },
    );
  }

  return (
    <Screen
      footer={
        canOffer ? (
          <Button title={t('makeOffer.send')} loading={make.isPending} onPress={send} />
        ) : chosen ? (
          <Button
            title={t('chat.openWithRequester')}
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/chat/[requestId]', params: { requestId: r.id } })
            }
          />
        ) : null
      }
    >
      <ScreenHeader title={canOffer ? t('makeOffer.title') : t('offers.requestTitle')} />

      <Card style={styles.group}>
        <View style={styles.row}>
          <IconTile name={categoryIcon(r.category_id)} tone="teal" size={64} />
          <View style={styles.flex}>
            <Text variant="heading">{r.item_name}</Text>
            <Text variant="caption" muted>
              {t('makeOffer.requestedBy', {
                name: shortName(requester?.full_name),
                city: cityName(requester?.home_city_id),
              })}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <MoneyRows
          rows={[
            { label: t('makeOffer.itemPriceFront'), value: formatPaise(item), strong: true },
            { label: t('makeOffer.budget'), value: formatPaise(r.budget_paise), strong: true },
          ]}
        />
        <Text variant="caption" muted>
          {`${t('requests.route', { from: cityName(r.from_city_id), to: cityName(r.to_city_id) })} · ${t('newRequest.byDate', { date: formatShortDate(r.deadline) })} · ${formatGrams(r.weight_grams)}`}
        </Text>
        {r.details ? <Text variant="body">{r.details}</Text> : null}
      </Card>

      {photo.data ? (
        <Image source={{ uri: photo.data }} style={styles.photo} contentFit="cover" />
      ) : null}

      {canOffer ? (
        <>
          <Card style={styles.group}>
            <TextField
              label={t('makeOffer.yourFare')}
              prefix="Rs"
              big
              keyboardType="number-pad"
              value={fare}
              onChangeText={(v) => setFare(v.replace(/\D/g, ''))}
              error={fareError}
              hint={t('makeOffer.bandHint', {
                weight: formatGrams(r.weight_grams),
                min: formatPaise(band.minPaise),
                max: formatPaise(band.maxPaise),
                fare: formatPaise(farePaise ?? 0),
                item: formatPaise(item),
              })}
            />
          </Card>
          <TextField
            label={t('makeOffer.message')}
            placeholder={t('offers.messagePlaceholder')}
            value={message}
            onChangeText={setMessage}
            maxLength={300}
            multiline
            style={styles.message}
          />
          <InfoBox tone="warning" icon="alert-circle">
            {t('makeOffer.check')}
          </InfoBox>
          {make.error ? (
            <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
              {dbErrorMessage(make.error, 'offers.sendFailed')}
            </Text>
          ) : null}
        </>
      ) : null}

      {mine && mine.status !== 'withdrawn' ? (
        <Card style={styles.group}>
          <View style={styles.row}>
            <Text variant="heading" style={styles.flex}>
              {t('makeOffer.yourOffer', { amount: formatPaise(mine.fare_paise) })}
            </Text>
            <Text variant="label" muted>
              {t(`offers.status.${mine.status}` as StringKey)}
            </Text>
          </View>
          {chosen && r.status === 'accepted' ? (
            <Text variant="caption" muted>
              {t('travelerRequest.waitingPayment')}
            </Text>
          ) : null}
          {mine.status === 'pending' ? (
            <>
              {withdraw.error ? (
                <Text variant="caption" style={styles.error}>
                  {dbErrorMessage(withdraw.error, 'offers.withdrawFailed')}
                </Text>
              ) : null}
              <Button
                title={t('offers.withdraw')}
                variant="outline"
                loading={withdraw.isPending}
                onPress={() => withdraw.mutate(mine.id)}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {!canOffer && !mine && open && !tripId ? (
        <InfoBox tone="neutral" icon="info">
          {t('travelerRequest.pickTrip')}
        </InfoBox>
      ) : null}

      <Button
        title={t('safety.reportOrBlock')}
        variant="link"
        onPress={() =>
          router.push({
            pathname: '/report/[userId]',
            params: { userId: r.requester_id, requestId: r.id },
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: colors.border },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  message: { minHeight: 72, textAlignVertical: 'top' },
  error: { color: colors.danger },
});
