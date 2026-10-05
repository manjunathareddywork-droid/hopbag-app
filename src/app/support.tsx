import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { InfoBox } from '@/components/info-box';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useSendSupport } from '@/features/profile/hooks';
import { t } from '@/i18n';
import { colors } from '@/theme';

/** A message to the Hopbag team; admins read it in the dashboard. */
export default function SupportScreen() {
  const send = useSendSupport();
  const [body, setBody] = useState('');

  return (
    <Screen
      footer={
        send.isSuccess ? null : (
          <Button
            title={t('support.send')}
            loading={send.isPending}
            disabled={body.trim().length < 5}
            onPress={() => send.mutate(body.trim())}
          />
        )
      }
    >
      <ScreenHeader title={t('support.title')} />
      {send.isSuccess ? (
        <InfoBox icon="check-circle">{t('support.sent')}</InfoBox>
      ) : (
        <>
          <Text variant="body" muted>
            {t('support.intro')}
          </Text>
          <TextField
            label={t('support.title')}
            placeholder={t('support.placeholder')}
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            style={styles.input}
          />
          {send.error ? (
            <Text variant="caption" style={styles.error}>
              {t('support.failed')}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 160, textAlignVertical: 'top' },
  error: { color: colors.danger },
});
