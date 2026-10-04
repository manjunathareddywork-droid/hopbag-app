import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { createOrder } from '@/features/payments/api';
import { checkoutHtml, parseCheckoutMessage } from '@/features/payments/checkout-html';
import { useVerifyPayment } from '@/features/payments/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { track } from '@/lib/monitoring';
import { colors, spacing } from '@/theme';

type Stage = 'checkout' | 'confirming' | 'done' | 'failed';

export default function PayScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const order = useMutation({ mutationFn: createOrder });
  const verify = useVerifyPayment();
  const [stage, setStage] = useState<Stage>('checkout');
  const [failure, setFailure] = useState<string>();
  // Bumping the key reloads the checkout page for "Try again".
  const [attempt, setAttempt] = useState(0);

  const { mutate: startOrder } = order;
  useEffect(() => {
    track('checkout_opened');
    startOrder(requestId);
  }, [startOrder, requestId]);

  function onMessage(raw: string) {
    const message = parseCheckoutMessage(raw);
    if (message.type === 'success') {
      setStage('confirming');
      const { type: _type, ...result } = message;
      verify.mutate(result, {
        onSuccess: () => {
          track('payment_completed');
          setStage('done');
        },
        onError: (error) => {
          setFailure(dbErrorMessage(error, 'payment.failedGeneric'));
          setStage('failed');
        },
      });
    } else if (message.type === 'failed') {
      track('payment_failed');
      setFailure(
        message.description
          ? t('payment.failed', { reason: message.description })
          : t('payment.failedGeneric'),
      );
      setStage('failed');
    } else {
      router.back();
    }
  }

  if (order.error) {
    return (
      <Centered>
        <Text variant="body" style={styles.center}>
          {dbErrorMessage(order.error, 'payment.failedGeneric')}
        </Text>
        <Button title={t('payment.backToRequest')} variant="secondary" onPress={router.back} />
      </Centered>
    );
  }

  if (!order.data) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text variant="body" muted>
          {t('payment.opening')}
        </Text>
      </Centered>
    );
  }

  if (stage === 'confirming') {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text variant="body" muted>
          {t('payment.confirming')}
        </Text>
      </Centered>
    );
  }

  if (stage === 'done') {
    return (
      <Centered>
        <Text variant="heading" style={styles.center}>
          {t('payment.success')}
        </Text>
        <Button title={t('payment.backToRequest')} onPress={router.back} />
      </Centered>
    );
  }

  if (stage === 'failed') {
    return (
      <Centered>
        <Text variant="body" style={[styles.center, styles.error]}>
          {failure}
        </Text>
        <Button
          title={t('payment.tryAgain')}
          onPress={() => {
            setStage('checkout');
            setAttempt((n) => n + 1);
          }}
        />
        <Button title={t('payment.backToRequest')} variant="secondary" onPress={router.back} />
      </Centered>
    );
  }

  const phone = session?.user.phone ? `+${session.user.phone}` : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <WebView
        key={attempt}
        originWhitelist={['*']}
        source={{
          html: checkoutHtml(order.data, { phone }),
          baseUrl: 'https://checkout.razorpay.com',
        }}
        onMessage={(event) => onMessage(event.nativeEvent.data)}
        javaScriptEnabled
        startInLoadingState
        style={styles.screen}
      />
    </SafeAreaView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  center: {
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
  },
});
