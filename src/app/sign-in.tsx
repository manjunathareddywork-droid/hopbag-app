import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authErrorKey, sendOtp } from '@/features/auth/api';
import { toIndianE164 } from '@/features/auth/phone';
import { t } from '@/i18n';
import { spacing } from '@/theme';

const logo = require('@/assets/brand/logo/hopbag-logo-horizontal-onlight.svg');

export default function SignInScreen() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState('');
  const [inputError, setInputError] = useState<string>();

  const send = useMutation({
    mutationFn: sendOtp,
    onSuccess: (_data, phone) => router.push({ pathname: '/verify', params: { phone } }),
  });

  function onSubmit() {
    const phone = toIndianE164(phoneInput);
    if (!phone) {
      setInputError(t('signIn.phoneInvalid'));
      return;
    }
    setInputError(undefined);
    send.mutate(phone);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={t('common.appName')}
        />
        <Text variant="title">{t('signIn.title')}</Text>
        <Text variant="body" muted>
          {t('signIn.subtitle')}
        </Text>
      </View>

      <TextField
        label={t('signIn.phoneLabel')}
        prefix="+91"
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

      <Button title={t('signIn.sendCode')} loading={send.isPending} onPress={onSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  logo: {
    width: 146,
    height: 40,
    marginBottom: spacing.lg,
  },
});
