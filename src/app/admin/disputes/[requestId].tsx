import { Image } from 'expo-image';
import { AdminOnly } from '@/features/admin/admin-only';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import {
  useDelivery,
  useDispute,
  usePickupPhotoUrl,
  useResolveRefund,
  useResolveRelease,
} from '@/features/delivery/hooks';
import { usePaymentForRequest } from '@/features/payments/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useRequest } from '@/features/requests/hooks';
import { formatGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDateTime } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

function AdminDisputeScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const request = useRequest(requestId);
  const dispute = useDispute(requestId);
  const delivery = useDelivery(requestId);
  const payment = usePaymentForRequest(requestId);
  const photo = usePickupPhotoUrl(delivery.data?.pickup_photo_path);
  const people = useProfilesByIds(dispute.data ? [dispute.data.raised_by] : []);
  const release = useResolveRelease();
  const refund = useResolveRefund();
  const [note, setNote] = useState('');

  if (!request.data || !dispute.data) {
    return (
      <LoadingView
        error={request.isError || dispute.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          dispute.refetch();
        }}
      />
    );
  }

  const r = request.data;
  const d = dispute.data;
  const amount = payment.data ? formatPaise(payment.data.amount_paise) : '';
  const busy = release.isPending || refund.isPending;
  const error = release.error ?? refund.error;

  function confirm(kind: 'release' | 'refund') {
    const message =
      kind === 'release'
        ? t('adminDisputes.releaseConfirm', { amount })
        : t('adminDisputes.refundConfirm', { amount });
    Alert.alert(message, undefined, [
      { text: t('offers.back'), style: 'cancel' },
      {
        text: t('adminDisputes.yes'),
        onPress: () =>
          (kind === 'release' ? release : refund).mutate(
            { requestId, note: note.trim() },
            { onSuccess: () => router.back() },
          ),
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <StatusChip status={r.status} />
        <Text variant="title">{r.item_name}</Text>
      </View>

      <View style={styles.card}>
        <DetailRow label={t('adminDisputes.reason')} value={d.reason} />
        <DetailRow label={t('adminDisputes.raisedBy')} value={people.data?.[0]?.full_name ?? ''} />
        <DetailRow
          label={t('admin.submitted', { date: '' }).trim()}
          value={formatDateTime(d.created_at)}
        />
        <DetailRow label={t('adminDisputes.amount')} value={amount} />
        {delivery.data ? (
          <DetailRow
            label={t('delivery.sectionTitle')}
            value={t('delivery.pickedUp', {
              date: formatDateTime(delivery.data.picked_up_at),
              weight: formatGrams(delivery.data.pickup_weight_grams),
            })}
          />
        ) : null}
      </View>

      {photo.data ? (
        <Image source={{ uri: photo.data }} style={styles.photo} contentFit="cover" />
      ) : null}

      {d.status === 'open' ? (
        <View style={styles.actions}>
          <TextField
            label={t('adminDisputes.noteLabel')}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
          />
          {error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(error, 'adminDisputes.failed')}
            </Text>
          ) : null}
          <Button
            title={t('adminDisputes.release')}
            loading={busy}
            onPress={() => confirm('release')}
          />
          <Button
            title={t('adminDisputes.refund')}
            variant="secondary"
            disabled={busy}
            onPress={() => confirm('refund')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});

export default function AdminDisputeScreenRoute() {
  return (
    <AdminOnly>
      <AdminDisputeScreen />
    </AdminOnly>
  );
}
