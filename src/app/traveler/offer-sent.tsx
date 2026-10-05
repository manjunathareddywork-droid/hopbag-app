import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { MoneyRows } from '@/components/money-rows';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import { formatPaise } from '@/lib/money';
import { colors, spacing } from '@/theme';

/** After sending an offer: what the traveler will receive if it is accepted. */
export default function OfferSentScreen() {
  const { requestId, fare } = useLocalSearchParams<{ requestId: string; fare: string }>();
  const router = useRouter();
  const request = useRequest(requestId).data;
  const requester = useProfilesByIds(request ? [request.requester_id] : []).data?.[0];
  const farePaise = Number(fare) || 0;
  const item = request?.item_price_paise ?? 0;
  const name = firstName(requester?.full_name);
  const toTrips = () => router.dismissTo('/trips');

  return (
    <Screen
      footer={
        <>
          <Button title={t('makeOffer.seeMore')} onPress={toTrips} />
          <Button title={t('makeOffer.viewActive')} variant="link" onPress={toTrips} />
        </>
      }
    >
      <View style={styles.top}>
        <View style={styles.circle}>
          <Icon name="send" size={40} color={colors.orange} />
        </View>
        <Text variant="display" style={styles.center}>
          {t('makeOffer.sentTitle', { name })}
        </Text>
        <Text variant="body" muted style={styles.center}>
          {t('makeOffer.sentBody', {
            fare: formatPaise(farePaise),
            item: request?.item_name ?? '',
          })}
        </Text>
      </View>
      <Card>
        <MoneyRows
          rows={[
            { label: t('makeOffer.yourFareRow'), value: formatPaise(farePaise), strong: true },
            { label: t('makeOffer.itemPriceBack'), value: formatPaise(item) },
          ]}
          total={{ label: t('makeOffer.receive'), value: formatPaise(farePaise + item) }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
