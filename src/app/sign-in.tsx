import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CheckRow } from '@/components/choice';
import { Screen } from '@/components/screen';
import { BackButton } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authErrorKey, sendOtp } from '@/features/auth/api';
import { toIndianE164 } from '@/features/auth/phone';
import { t } from '@/i18n';
import { track } from '@/lib/monitoring';
import { colors, spacing } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [inputError, setInputError] = useState<string>();

  const send = useMutation({
    mutationFn: sendOtp,
    onSuccess: (_data, phone) => {
      track('otp_requested');
      router.push({ pathname: '/verify', params: { phone } });
    },
  });

  function onSubmit() {
    const phone = toIndianE164(phoneInput);
    if (!phone) {
      setInputError(t('signIn.phoneInvalid'));
      return;
    }
    if (!agreed) {
      setInputError(t('auth.agreeRequired'));
      return;
    }
    setInputError(undefined);
    send.mutate(phone);
  }

  return (
    <Screen
      footer={<Button title={t('signIn.sendCode')} loading={send.isPending} onPress={onSubmit} />}
    >
      {router.canGoBack() ? <BackButton /> : null}
      <View style={styles.header}>
        <Text variant="display">{t('auth.phoneTitle')}</Text>
        <Text variant="body" muted>
          {t('auth.phoneSubtitle')}
        </Text>
      </View>

      <TextField
        label={t('signIn.phoneLabel')}
        prefixBox="+91"
        placeholder={t('signIn.phonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={14}
        value={phoneInput}
        onChangeText={setPhoneInput}
        onSubmitEditing={onSubmit}
        error={
          inputError ?? (send.error ? t(authErrorKey(send.error, 'signIn.sendFailed')) : undefined)
        }
      />

      <CheckRow
        checked={agreed}
        onChange={setAgreed}
        label={
          <Text variant="caption" muted>
            {t('auth.agree')}
          </Text>
        }
      />
      <View style={styles.legal}>
        <Link href="/legal/terms" style={styles.legalLink}>
          <Text variant="caption">{t('legal.termsTitle')}</Text>
        </Link>
        <Link href="/legal/privacy" style={styles.legalLink}>
          <Text variant="caption">{t('legal.privacyTitle')}</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.md },
  legal: { flexDirection: 'row', gap: spacing.lg, marginLeft: 44 },
  legalLink: {
    paddingVertical: spacing.xs,
    textDecorationLine: 'underline',
    color: colors.text,
  },
});
