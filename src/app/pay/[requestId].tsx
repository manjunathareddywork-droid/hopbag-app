import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useOffersForRequest } from '@/features/offers/hooks';
import { createOrder } from '@/features/payments/api';
import { checkoutHtml, parseCheckoutMessage } from '@/features/payments/checkout-html';
import { platformFee } from '@/features/payments/fee';
import { useVerifyPayment } from '@/features/payments/hooks';
import { useCities } from '@/features/places/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { useSettings } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatPaise } from '@/lib/money';
import { track } from '@/lib/monitoring';
import { colors, fonts, spacing } from '@/theme';

type Stage = 'summary' | 'checkout' | 'confirming';

/**
 * Summary of what will be held, then Razorpay checkout (UPI, card or net banking are
 * chosen inside Razorpay). The server recomputes the amount; this screen only shows it.
 */
export default function PayScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const request = useRequest(requestId);
  const offers = useOffersForRequest(requestId);
  const cities = useCities();
  const settings = useSettings();
  const order = useMutation({ mutationFn: createOrder });
  const verify = useVerifyPayment();
  const [stage, setStage] = useState<Stage>('summary');
  const [failure, setFailure] = useState<string>();

  const offer = offers.data?.find((o) => o.id === request.data?.accepted_offer_id);
  const traveler = useProfilesByIds(offer ? [offer.traveler_id] : []).data?.[0];

  useEffect(() => {
    track('checkout_opened');
  }, []);

  function pay() {
    setFailure(undefined);
    order.mutate(requestId, { onSuccess: () => setStage('checkout') });
  }

  function onMessage(raw: string) {
    const message = parseCheckoutMessage(raw);
    if (message.type === 'success') {
      setStage('confirming');
      const { type: _type, ...result } = message;
      verify.mutate(result, {
        onSuccess: () => {
          track('payment_completed');
          router.replace({ pathname: '/paid/[requestId]', params: { requestId } });
        },
        onError: (error) => {
          setFailure(dbErrorMessage(error, 'payment.failedGeneric'));
          setStage('summary');
        },
      });
    } else if (message.type === 'failed') {
      track('payment_failed');
      setFailure(
        message.description
          ? t('payment.failed', { reason: message.description })
          : t('payment.failedGeneric'),
      );
      setStage('summary');
    } else {
      setStage('summary');
    }
  }

  if (stage === 'confirming') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text variant="body" muted>
          {t('payment.confirming')}
        </Text>
      </View>
    );
  }

  if (stage === 'checkout' && order.data) {
    const phone = session?.user.phone ? `+${session.user.phone}` : undefined;
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <WebView
          originWhitelist={['*']}
          source={{
            html: checkoutHtml(order.data, { phone }),
            baseUrl: 'https://checkout.razorpay.com',
          }}
          onMessage={(event) => onMessage(event.nativeEvent.data)}
          javaScriptEnabled
          startInLoadingState
          style={styles.flex}
        />
      </SafeAreaView>
    );
  }

  if (!request.data || !offers.data || !cities.data) {
    return (
      <LoadingView
        error={request.isError || offers.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          offers.refetch();
        }}
      />
    );
  }

  const r = request.data;
  const fare = offer?.fare_paise ?? 0;
  const total =
    (r.item_price_paise ?? 0) + fare + platformFee(fare, settings.data?.platform_fee_bps);
  const city = cities.data.find((c) => c.id === r.from_city_id)?.name ?? '';
  const error =
    failure ?? (order.error ? dbErrorMessage(order.error, 'payment.failedGeneric') : undefined);

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('payScreen.pay', { amount: formatPaise(total) })}
            loading={order.isPending}
            disabled={r.status !== 'accepted' || !offer}
            onPress={pay}
          />
          <Text variant="caption" muted style={styles.center}>
            {t('payScreen.processedBy')}
          </Text>
        </>
      }
    >
      <ScreenHeader title={t('payScreen.title')} />
      <Card tone="dark" style={styles.hero}>
        <Text variant="caption" style={styles.lightMuted}>
          {t('payScreen.totalToHold')}
        </Text>
        <Text style={styles.amount}>{formatPaise(total)}</Text>
        <Text variant="caption" style={styles.lightMuted}>
          {t('payScreen.summary', {
            item: r.item_name,
            city,
            name: firstName(traveler?.full_name),
          })}
        </Text>
      </Card>
      <InfoBox icon="lock">{t('payScreen.heldNote')}</InfoBox>
      <Text variant="caption" muted>
        {t('payment.testMode')}
      </Text>
      {error ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  hero: { gap: spacing.xs, paddingVertical: spacing.lg },
  lightMuted: { color: colors.textOnDarkMuted },
  amount: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, color: colors.white },
  center: { textAlign: 'center' },
  error: { color: colors.danger },
});
