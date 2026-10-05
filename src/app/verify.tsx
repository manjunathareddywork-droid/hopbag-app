import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CodeBoxes } from '@/components/code-boxes';
import { Screen } from '@/components/screen';
import { BackButton } from '@/components/screen-header';
import { Text } from '@/components/text';
import { authErrorKey, sendOtp, verifyOtp } from '@/features/auth/api';
import { formatIndianPhone } from '@/features/auth/phone';
import { t } from '@/i18n';
import { track } from '@/lib/monitoring';
import { colors, fonts, spacing } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState<string>();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // On success the session changes and the root navigator moves on by itself.
  const verify = useMutation({
    mutationFn: (token: string) => verifyOtp(phone, token),
    onSuccess: () => track('signed_in'),
  });
  const resend = useMutation({
    mutationFn: () => sendOtp(phone),
    onSuccess: () => setSecondsLeft(RESEND_SECONDS),
  });

  function onSubmit(value = code) {
    if (!/^\d{6}$/.test(value)) {
      setInputError(t('verify.codeInvalid'));
      return;
    }
    setInputError(undefined);
    verify.mutate(value);
  }

  function onChangeCode(digits: string) {
    setCode(digits);
    // Submit automatically once all 6 digits are in (including SMS autofill).
    if (digits.length === 6 && !verify.isPending) onSubmit(digits);
  }

  const error =
    inputError ?? (verify.error ? t(authErrorKey(verify.error, 'verify.wrongCode')) : undefined);
  const clock = `0:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <Screen
      footer={
        <Button title={t('verify.submit')} loading={verify.isPending} onPress={() => onSubmit()} />
      }
    >
      <BackButton />
      <View style={styles.header}>
        <Text variant="display">{t('auth.codeTitle')}</Text>
        <Text variant="body" muted>
          {t('auth.sentTo', { phone: formatIndianPhone(phone) })}{' '}
          <Text
            variant="bodyStrong"
            style={styles.change}
            accessibilityRole="link"
            onPress={() => router.back()}
          >
            {t('auth.change')}
          </Text>
        </Text>
      </View>

      <CodeBoxes
        length={6}
        value={code}
        onChange={onChangeCode}
        accessibilityLabel={t('verify.codeLabel')}
        autoFocus
      />
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {resend.error ? (
        <Text variant="caption" style={styles.error}>
          {t(authErrorKey(resend.error, 'signIn.sendFailed'))}
        </Text>
      ) : null}

      <View style={styles.resendRow}>
        <Text variant="caption" muted>
          {secondsLeft > 0 ? t('auth.resendIn', { time: clock }) : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={secondsLeft > 0 || resend.isPending}
          onPress={() => resend.mutate()}
          hitSlop={12}
        >
          <Text style={[styles.resend, secondsLeft > 0 && styles.resendOff]}>
            {t('auth.resend')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.md },
  change: { textDecorationLine: 'underline' },
  error: { color: colors.danger },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resend: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  resendOff: { color: colors.textSubtle },
});
