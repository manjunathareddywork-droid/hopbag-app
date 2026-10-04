import { Link } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import type { ItemRequest, Offer } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

import { usePaymentForRequest, useRefundPayment } from './hooks';

type Props = {
  request: ItemRequest;
  acceptedOffer: Offer | undefined;
};

/** Requester's payment box: pay after accepting, then held / refund status. */
export function PaymentCard({ request, acceptedOffer }: Props) {
  const payment = usePaymentForRequest(request.id);
  const refund = useRefundPayment();
  const p = payment.data;

  if (request.status === 'accepted' && acceptedOffer) {
    if (request.item_price_paise === null) {
      return (
        <Box>
          <Text variant="body">{t('payment.needsPrice')}</Text>
        </Box>
      );
    }
    const total = request.item_price_paise + acceptedOffer.fare_paise;
    return (
      <Box>
        <Text variant="heading">{t('payment.sectionTitle')}</Text>
        <View style={styles.rows}>
          <DetailRow label={t('payment.itemPrice')} value={formatPaise(request.item_price_paise)} />
          <DetailRow label={t('payment.fare')} value={formatPaise(acceptedOffer.fare_paise)} />
          <DetailRow label={t('payment.total')} value={formatPaise(total)} />
        </View>
        <Text variant="caption" muted>
          {t('payment.whyNow')}
        </Text>
        <Text variant="caption" muted>
          {t('payment.testMode')}
        </Text>
        <Link href={{ pathname: '/pay/[requestId]', params: { requestId: request.id } }} asChild>
          <Button title={t('payment.payButton', { amount: formatPaise(total) })} />
        </Link>
      </Box>
    );
  }

  if (!p) return null;
  const amount = formatPaise(p.amount_paise);

  function confirmRefund() {
    Alert.alert(t('payment.refundConfirm', { amount }), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      {
        text: t('payment.refundYes'),
        style: 'destructive',
        onPress: () => refund.mutate(request.id),
      },
    ]);
  }

  return (
    <Box>
      <Text variant="heading">{t('payment.sectionTitle')}</Text>
      {p.status === 'captured' ? (
        <Text variant="body">{t('payment.held', { amount })}</Text>
      ) : p.status === 'refund_pending' ? (
        <Text variant="body">{t('payment.refundPending', { amount })}</Text>
      ) : p.status === 'refunded' ? (
        <Text variant="body">{t('payment.refunded', { amount })}</Text>
      ) : null}
      {request.status === 'paid' && p.status === 'captured' ? (
        <>
          {refund.error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(refund.error, 'payment.refundFailed')}
            </Text>
          ) : null}
          <Button
            title={t('payment.cancelAndRefund')}
            variant="secondary"
            loading={refund.isPending}
            onPress={confirmRefund}
          />
        </>
      ) : null}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <View style={styles.box}>{children}</View>;
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
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginHorizontal: -spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
