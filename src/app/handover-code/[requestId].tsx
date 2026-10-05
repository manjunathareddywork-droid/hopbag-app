import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CodeBoxes } from '@/components/code-boxes';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useConfirmReceived, useIssueHandoverCode } from '@/features/delivery/hooks';
import { useOffersForRequest } from '@/features/offers/hooks';
import { usePaymentForRequest } from '@/features/payments/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatPaise } from '@/lib/money';
import { colors, spacing } from '@/theme';

/** The requester's one-time code. Each visit makes a new code; the old one stops working. */
export default function HandoverCodeScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const issue = useIssueHandoverCode();
  const confirm = useConfirmReceived();
  const request = useRequest(requestId).data;
  const payment = usePaymentForRequest(requestId).data;
  const offer = useOffersForRequest(requestId).data?.find(
    (o) => o.id === request?.accepted_offer_id,
  );
  const name = firstName(useProfilesByIds(offer ? [offer.traveler_id] : []).data?.[0]?.full_name);
  const [confirming, setConfirming] = useState(false);
  const { mutate } = issue;

  useEffect(() => {
    mutate(requestId);
  }, [mutate, requestId]);

  // Once the delivery settles (code used or receipt confirmed), show the rating screen.
  useEffect(() => {
    if (request?.status === 'settled') {
      router.replace({ pathname: '/delivered/[requestId]', params: { requestId } });
    }
  }, [request?.status, router, requestId]);

  const amount = payment ? formatPaise(payment.amount_paise) : '';

  return (
    <Screen
      footer={
        <>
          {confirm.error ? (
            <Text variant="caption" style={styles.error}>
              {dbErrorMessage(confirm.error, 'delivery.actionFailed')}
            </Text>
          ) : null}
          {confirming ? (
            <>
              <Text variant="caption" muted style={styles.center}>
                {t('delivery.receiveConfirm')}
              </Text>
              <Button
                title={t('delivery.receiveYes')}
                loading={confirm.isPending}
                onPress={() =>
                  confirm.mutate(requestId, {
                    onSuccess: () =>
                      router.replace({
                        pathname: '/delivered/[requestId]',
                        params: { requestId },
                      }),
                  })
                }
              />
            </>
          ) : (
            <Button title={t('codeScreen.received')} onPress={() => setConfirming(true)} />
          )}
          <Button
            title={t('codeScreen.problem')}
            variant="dangerLink"
            onPress={() => router.push({ pathname: '/dispute/[requestId]', params: { requestId } })}
          />
        </>
      }
    >
      <ScreenHeader title={t('codeScreen.title')} />
      <Text variant="body" muted>
        {t('codeScreen.intro', { name, item: request?.item_name ?? '' })}
      </Text>

      <Card tone="dark" style={styles.codeCard}>
        <Text variant="small" style={styles.label}>
          {t('codeScreen.label')}
        </Text>
        {issue.data ? (
          <CodeBoxes
            length={6}
            value={issue.data}
            display
            accessibilityLabel={t('codeScreen.label')}
          />
        ) : (
          <ActivityIndicator size="large" color={colors.white} />
        )}
        <Text variant="caption" style={styles.lightMuted}>
          {t('codeScreen.valid')}
        </Text>
      </Card>
      {issue.error ? (
        <Text variant="body" style={styles.error}>
          {dbErrorMessage(issue.error, 'delivery.actionFailed')}
        </Text>
      ) : null}

      <Card style={styles.notes}>
        <View style={styles.note}>
          <Icon name="shield" size={22} />
          <Text variant="caption" style={styles.flex}>
            {t('codeScreen.releases', { name, amount })}
          </Text>
        </View>
        <View style={styles.note}>
          <Icon name="clock" size={22} />
          <Text variant="caption" style={styles.flex}>
            {t('codeScreen.auto', { name })}
          </Text>
        </View>
      </Card>
      <Button
        title={t('delivery.codeNew')}
        variant="link"
        loading={issue.isPending}
        onPress={() => mutate(requestId)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  label: { color: colors.textOnDarkMuted, letterSpacing: 1.5 },
  lightMuted: { color: colors.textOnDarkMuted, textAlign: 'center' },
  notes: { gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  error: { color: colors.danger, textAlign: 'center' },
  center: { textAlign: 'center' },
});
