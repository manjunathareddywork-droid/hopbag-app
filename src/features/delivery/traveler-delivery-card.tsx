import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { PhotoField } from '@/components/photo-field';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { kgToGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import type { ItemRequest } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDateTime } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

import { DisputeNotice } from './dispute-notice';
import {
  useConfirmDeliveryCode,
  useDelivery,
  useDispute,
  useMarkHandedOver,
  useMarkPickedUp,
  useMyPayouts,
} from './hooks';

/** The traveler's side of delivery: pickup proof, code entry, handover, payout. */
export function TravelerDeliveryCard({ request }: { request: ItemRequest }) {
  const delivery = useDelivery(request.id);
  const dispute = useDispute(request.id);
  const payouts = useMyPayouts();
  const payout = payouts.data?.find((p) => p.request_id === request.id);
  const canReport = ['paid', 'picked_up', 'delivered'].includes(request.status);

  return (
    <View style={styles.box}>
      <Text variant="heading">{t('delivery.sectionTitle')}</Text>
      {request.status === 'paid' ? <PickupForm requestId={request.id} /> : null}
      {request.status === 'picked_up' ? <CodeEntry requestId={request.id} /> : null}
      {request.status === 'delivered' && delivery.data?.confirm_by ? (
        <Text variant="body">
          {t('delivery.waitingConfirm', { deadline: formatDateTime(delivery.data.confirm_by) })}
        </Text>
      ) : null}
      {request.status === 'settled' && payout ? (
        <>
          <Text variant="body">
            {t('delivery.paidOut', {
              amount: formatPaise(payout.net_paise),
              fee: formatPaise(payout.fee_paise),
            })}
          </Text>
          <Text variant="caption" muted>
            {t('delivery.payoutNote')}
          </Text>
        </>
      ) : null}
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

function PickupForm({ requestId }: { requestId: string }) {
  const pickup = useMarkPickedUp();
  const [photo, setPhoto] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    const grams = kgToGrams(weight);
    if (!photo) return setError(t('delivery.photoRequired'));
    if (grams === null) return setError(t('requests.errors.weightInvalid'));
    setError(undefined);
    pickup.mutate({ requestId, photoUri: photo, weightGrams: grams });
  }

  return (
    <View style={styles.group}>
      <Text variant="label">{t('delivery.travelerPickupTitle')}</Text>
      <Text variant="body" muted>
        {t('delivery.travelerPickupHelp')}
      </Text>
      <PhotoField label={t('delivery.pickupPhotoLabel')} value={photo} onChange={setPhoto} />
      <TextField
        label={t('delivery.pickupWeightLabel')}
        placeholder="1.2"
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />
      {error || pickup.error ? (
        <Text variant="body" style={styles.error}>
          {error ?? dbErrorMessage(pickup.error, 'delivery.pickupFailed')}
        </Text>
      ) : null}
      <Button title={t('delivery.markPickedUp')} loading={pickup.isPending} onPress={submit} />
    </View>
  );
}

function CodeEntry({ requestId }: { requestId: string }) {
  const confirmCode = useConfirmDeliveryCode();
  const handOver = useMarkHandedOver();
  const [code, setCode] = useState('');
  const result = confirmCode.data;

  function handOverWithoutCode() {
    Alert.alert(t('delivery.handoverConfirm'), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      { text: t('delivery.handoverYes'), onPress: () => handOver.mutate(requestId) },
    ]);
  }

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

  return (
    <View style={styles.group}>
      <Text variant="label">{t('delivery.enterCodeTitle')}</Text>
      <Text variant="body" muted>
        {t('delivery.enterCodeHelp')}
      </Text>
      <TextField
        label={t('delivery.codeLabel')}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        style={styles.code}
      />
      {message ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <Button
        title={t('delivery.confirmCode')}
        loading={confirmCode.isPending}
        disabled={code.length !== 6}
        onPress={() => confirmCode.mutate({ requestId, code })}
      />
      <Button
        title={t('delivery.noCodeHandover')}
        variant="secondary"
        loading={handOver.isPending}
        onPress={handOverWithoutCode}
      />
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
  group: {
    gap: spacing.md,
  },
  code: {
    fontSize: 24,
    letterSpacing: 8,
  },
  error: {
    color: colors.danger,
  },
});
