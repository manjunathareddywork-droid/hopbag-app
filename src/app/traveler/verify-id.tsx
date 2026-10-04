import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { PhotoField } from '@/components/photo-field';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { Text } from '@/components/text';
import { useSubmitVerification } from '@/features/travelers/hooks';
import {
  ID_TYPES,
  verificationSchema,
  type VerificationFormValues,
} from '@/features/travelers/schema';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors, spacing } from '@/theme';

const errorText = (message?: string) => (message ? t(message as StringKey) : undefined);

export default function VerifyIdScreen() {
  const router = useRouter();
  const submit = useSubmitVerification();
  const { control, handleSubmit } = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
  });

  return (
    <Screen>
      <Text variant="body" muted>
        {t('verifyId.intro')}
      </Text>

      <Controller
        control={control}
        name="idType"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <SelectField
              label={t('verifyId.idTypeLabel')}
              placeholder={t('verifyId.idTypePlaceholder')}
              items={ID_TYPES.map((id) => ({ value: id, label: t(`idTypes.${id}` as StringKey) }))}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errorText(fieldState.error?.message)}
            />
            {field.value === 'aadhaar' ? (
              <Text variant="caption" muted>
                {t('verifyId.aadhaarTip')}
              </Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="photoUri"
        render={({ field, fieldState }) => (
          <PhotoField
            label={t('verifyId.photoLabel')}
            tip={t('verifyId.photoTip')}
            value={field.value ?? null}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      {submit.error ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {dbErrorMessage(submit.error, 'verifyId.submitFailed')}
        </Text>
      ) : null}

      <Button
        title={t('verifyId.submit')}
        loading={submit.isPending}
        onPress={handleSubmit((values) =>
          submit.mutate(values, { onSuccess: () => router.back() }),
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
  },
});
