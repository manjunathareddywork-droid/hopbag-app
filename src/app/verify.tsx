import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authErrorKey, sendOtp, verifyOtp } from '@/features/auth/api';
import { formatIndianPhone } from '@/features/auth/phone';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

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
  const verify = useMutation({ mutationFn: (token: string) => verifyOtp(phone, token) });
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

  function onChangeCode(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Submit automatically once all 6 digits are in (including SMS autofill).
    if (digits.length === 6 && !verify.isPending) onSubmit(digits);
  }

  const error =
    inputError ?? (verify.error ? t(authErrorKey(verify.error, 'verify.wrongCode')) : undefined);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{t('verify.title')}</Text>
        <Text variant="body" muted>
          {t('verify.subtitle', { phone: formatIndianPhone(phone) })}
        </Text>
      </View>

      <TextField
        label={t('verify.codeLabel')}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        value={code}
        onChangeText={onChangeCode}
        style={styles.codeInput}
        error={error}
      />

      <Button title={t('verify.submit')} loading={verify.isPending} onPress={() => onSubmit()} />

      <View style={styles.links}>
        {resend.isSuccess && secondsLeft > 0 ? (
          <Text variant="caption" style={styles.success}>
            {t('verify.resent')}
          </Text>
        ) : null}
        {resend.error ? (
          <Text variant="caption" style={styles.danger}>
            {t(authErrorKey(resend.error, 'signIn.sendFailed'))}
          </Text>
        ) : null}
        <Button
          variant="secondary"
          title={
            secondsLeft > 0 ? t('verify.resendIn', { seconds: secondsLeft }) : t('verify.resend')
          }
          disabled={secondsLeft > 0}
          loading={resend.isPending}
          onPress={() => resend.mutate()}
        />
        <Button
          variant="secondary"
          title={t('verify.changeNumber')}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
  },
  links: {
    gap: spacing.md,
  },
  success: {
    color: colors.success,
    textAlign: 'center',
  },
  danger: {
    color: colors.danger,
    textAlign: 'center',
  },
});
