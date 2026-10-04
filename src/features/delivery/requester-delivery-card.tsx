import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { formatGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import type { ItemRequest } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDateTime } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

import { DisputeNotice } from './dispute-notice';
import { useConfirmReceived, useDelivery, useDispute, usePickupPhotoUrl } from './hooks';

const SHOWN_FOR = ['paid', 'picked_up', 'delivered', 'settled', 'disputed'];

/** The requester's side of delivery: pickup proof, handover code, confirm, problems. */
export function RequesterDeliveryCard({ request }: { request: ItemRequest }) {
  const delivery = useDelivery(request.id);
  const dispute = useDispute(request.id);
  const photo = usePickupPhotoUrl(delivery.data?.pickup_photo_path);
  const confirm = useConfirmReceived();

  if (!SHOWN_FOR.includes(request.status)) return null;
  const d = delivery.data;
  const canReport = ['paid', 'picked_up', 'delivered'].includes(request.status);

  function confirmReceipt() {
    Alert.alert(t('delivery.receiveConfirm'), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      { text: t('delivery.receiveYes'), onPress: () => confirm.mutate(request.id) },
    ]);
  }

  return (
    <View style={styles.box}>
      <Text variant="heading">{t('delivery.sectionTitle')}</Text>

      {request.status === 'paid' ? <Text variant="body">{t('delivery.waitingPickup')}</Text> : null}

      {d ? (
        <>
          <Text variant="body">
            {t('delivery.pickedUp', {
              date: formatDateTime(d.picked_up_at),
              weight: formatGrams(d.pickup_weight_grams),
            })}
          </Text>
          {photo.data ? (
            <Image
              source={{ uri: photo.data }}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel={t('delivery.pickupPhoto')}
            />
          ) : null}
        </>
      ) : null}

      {request.status === 'picked_up' || request.status === 'delivered' ? (
        <Link
          href={{ pathname: '/handover-code/[requestId]', params: { requestId: request.id } }}
          asChild
        >
          <Button title={t('delivery.showCode')} />
        </Link>
      ) : null}

      {request.status === 'delivered' && d?.delivery_method === 'handover' && d.confirm_by ? (
        <>
          <Text variant="body">
            {t('delivery.handedOver', {
              date: formatDateTime(d.delivered_at ?? d.picked_up_at),
              deadline: formatDateTime(d.confirm_by),
            })}
          </Text>
          {confirm.error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(confirm.error, 'delivery.actionFailed')}
            </Text>
          ) : null}
          <Button
            title={t('delivery.iReceivedIt')}
            loading={confirm.isPending}
            onPress={confirmReceipt}
          />
        </>
      ) : null}

      {request.status === 'settled' ? <Text variant="body">{t('delivery.completed')}</Text> : null}

      {dispute.data ? <DisputeNotice dispute={dispute.data} /> : null}

      {canReport ? (
        <Link
          href={{ pathname: '/dispute/[requestId]', params: { requestId: request.id } }}
          asChild
        >
          <Button title={t('delivery.reportProblem')} variant="secondary" />
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  error: {
    color: colors.danger,
  },
});
