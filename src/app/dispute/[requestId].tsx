import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useRaiseDispute } from '@/features/delivery/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { colors } from '@/theme';

export default function DisputeScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const raise = useRaiseDispute();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    if (reason.trim().length < 10) return setError(t('dispute.reasonShort'));
    setError(undefined);
    raise.mutate({ requestId, reason: reason.trim() }, { onSuccess: () => router.back() });
  }

  return (
    <Screen>
      <Text variant="body" muted>
        {t('dispute.help')}
      </Text>
      <TextField
        label={t('dispute.reasonLabel')}
        placeholder={t('dispute.reasonPlaceholder')}
        value={reason}
        onChangeText={setReason}
        maxLength={1000}
        multiline
        error={error}
      />
      {raise.error ? (
        <Text variant="body" style={{ color: colors.danger }}>
          {dbErrorMessage(raise.error, 'dispute.failed')}
        </Text>
      ) : null}
      <Button title={t('dispute.submit')} loading={raise.isPending} onPress={submit} />
    </Screen>
  );
}
