import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Timeline } from '@/components/timeline';
import { useOffersForRequest } from '@/features/offers/hooks';
import { usePaymentForRequest } from '@/features/payments/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import { formatDay, formatStamp } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, spacing } from '@/theme';

/** Shown right after a successful payment. */
export default function PaidScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const request = useRequest(requestId).data;
  const payment = usePaymentForRequest(requestId).data;
  const offer = useOffersForRequest(requestId).data?.find(
    (o) => o.id === request?.accepted_offer_id,
  );
  const traveler = useProfilesByIds(offer ? [offer.traveler_id] : []).data?.[0];
  const city = useCities().data?.find((c) => c.id === request?.to_city_id)?.name ?? '';
  const name = firstName(traveler?.full_name);

  const open = () => router.replace({ pathname: '/requests/[id]', params: { id: requestId } });

  return (
    <Screen
      footer={
        <>
          <Button title={t('payScreen.track')} onPress={open} />
          <Button
            title={t('payScreen.message', { name })}
            variant="link"
            onPress={() => router.replace({ pathname: '/chat/[requestId]', params: { requestId } })}
          />
        </>
      }
    >
      <View style={styles.top}>
        <View style={styles.circle}>
          <Icon name="check" size={44} color={colors.orange} />
        </View>
        <Text variant="display" style={styles.center}>
          {t('payScreen.heldTitle')}
        </Text>
        <Text variant="body" muted style={styles.center}>
          {t('payScreen.heldBody', {
            amount: payment ? formatPaise(payment.amount_paise) : '',
            name,
            item: request?.item_name ?? '',
          })}
        </Text>
      </View>
      <Card>
        <Timeline
          steps={[
            {
              title: t('payScreen.stepPaid'),
              detail: payment?.captured_at ? formatStamp(payment.captured_at) : undefined,
              state: 'done',
            },
            {
              title: t('payScreen.stepPickup', { name }),
              detail: t('payScreen.stepPickupDetail'),
              state: 'current',
            },
            {
              title: t('payScreen.stepArrive', {
                city,
                date: offer ? formatDay(offer.travel_date) : '',
              }),
              state: 'todo',
            },
            { title: t('payScreen.stepCode'), state: 'todo' },
          ]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  circle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
