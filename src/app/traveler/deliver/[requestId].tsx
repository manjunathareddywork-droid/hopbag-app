import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CodeBoxes } from '@/components/code-boxes';
import { IconButton } from '@/components/icon-button';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { formatIndianPhone } from '@/features/auth/phone';
import { useCounterpartPhone } from '@/features/chat/hooks';
import { DisputeNotice } from '@/features/delivery/dispute-notice';
import {
  useConfirmDeliveryCode,
  useDelivery,
  useDispute,
  useMarkHandedOver,
} from '@/features/delivery/hooks';
import { useOffersForRequest } from '@/features/offers/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName, shortName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatShortDate, formatStamp } from '@/lib/dates';
import { colors, spacing } from '@/theme';

/** Carrying the item: enter the requester's code at handover to finish and get paid. */
export default function DeliverScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const request = useRequest(requestId);
  const delivery = useDelivery(requestId).data;
  const dispute = useDispute(requestId).data;
  const offer = useOffersForRequest(requestId).data?.find(
    (o) => o.id === request.data?.accepted_offer_id,
  );
  const requester = useProfilesByIds(request.data ? [request.data.requester_id] : []).data?.[0];
  const cities = useCities().data;
  const phone = useCounterpartPhone(requestId).data;
  const confirmCode = useConfirmDeliveryCode();
  const handOver = useMarkHandedOver();
  const [code, setCode] = useState('');
  const [confirmHandover, setConfirmHandover] = useState(false);

  const status = request.data?.status;
  useEffect(() => {
    if (status === 'settled') {
      router.replace({ pathname: '/delivered/[requestId]', params: { requestId } });
    }
  }, [status, router, requestId]);

  if (!request.data) {
    return (
      <LoadingView
        error={request.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => request.refetch()}
      />
    );
  }
  const r = request.data;
  const cityName = (id: number) => cities?.find((c) => c.id === id)?.name ?? '';
  const name = firstName(requester?.full_name);
  const result = confirmCode.data;
  const message =
    result === 'wrong_code'
      ? t('delivery.wrongCode')
      : result === 'locked'
        ? t('delivery.codeLocked')
        : confirmCode.error
          ? dbErrorMessage(confirmCode.error, 'delivery.actionFailed')
          : handOver.error
            ? dbErrorMessage(handOver.error, 'delivery.actionFailed')
            : undefined;
  const carrying = r.status === 'picked_up';

  return (
    <Screen
      footer={
        carrying ? (
          <>
            <Button
              title={t('deliveryProgress.confirm')}
              loading={confirmCode.isPending}
              disabled={code.length !== 6}
              onPress={() => confirmCode.mutate({ requestId, code })}
            />
            {confirmHandover ? (
              <Button
                title={t('delivery.handoverYes')}
                variant="link"
                loading={handOver.isPending}
                onPress={() => handOver.mutate(requestId)}
              />
            ) : (
              <Button
                title={t('deliveryProgress.noCode')}
                variant="link"
                onPress={() => setConfirmHandover(true)}
              />
            )}
          </>
        ) : null
      }
    >
      <ScreenHeader title={t('deliveryProgress.title')} />
      <Card tone="dark" style={styles.hero}>
        <Text variant="caption" style={styles.lightMuted}>
          {t('deliveryProgress.carryingFor', { name: shortName(requester?.full_name) })}
        </Text>
        <Text variant="heading" style={styles.light}>
          {r.item_name}
        </Text>
        <Text variant="caption" style={styles.lightMuted}>
          {t('deliveryProgress.routeDate', {
            from: cityName(r.from_city_id),
            to: cityName(r.to_city_id),
            date: offer ? formatShortDate(offer.travel_date) : '',
          })}
        </Text>
      </Card>

      {dispute ? <DisputeNotice dispute={dispute} /> : null}

      {carrying ? (
        <Card style={styles.group}>
          <Text variant="heading">{t('deliveryProgress.askCode', { name })}</Text>
          <Text variant="caption" muted>
            {t('deliveryProgress.askCodeBody')}
          </Text>
          <CodeBoxes
            length={6}
            value={code}
            onChange={setCode}
            onLight={false}
            accessibilityLabel={t('delivery.codeLabel')}
          />
          {confirmHandover ? (
            <Text variant="caption" muted>
              {t('delivery.handoverConfirm')}
            </Text>
          ) : null}
          {message ? (
            <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {r.status === 'delivered' && delivery?.confirm_by ? (
        <InfoBox tone="neutral" icon="clock">
          {t('deliveryProgress.waiting', { name, deadline: formatStamp(delivery.confirm_by) })}
        </InfoBox>
      ) : null}

      <Card style={styles.row}>
        <Avatar name={requester?.full_name} size={52} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{requester?.full_name ?? ''}</Text>
          <Text variant="caption" muted>
            {phone
              ? t('deliveryProgress.phone', { phone: formatIndianPhone(phone) })
              : t('deliveryProgress.phoneLater')}
          </Text>
        </View>
        <IconButton
          icon="message-square"
          label={t('chat.openWithRequester')}
          onPress={() => router.push({ pathname: '/chat/[requestId]', params: { requestId } })}
        />
      </Card>

      {['picked_up', 'delivered'].includes(r.status) ? (
        <Button
          title={t('delivery.reportProblem')}
          variant="link"
          onPress={() => router.push({ pathname: '/dispute/[requestId]', params: { requestId } })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  light: { color: colors.white },
  lightMuted: { color: colors.textOnDarkMuted },
  group: { gap: spacing.md - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  error: { color: colors.danger },
});
