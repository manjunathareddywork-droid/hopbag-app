import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

type Props = {
  saving: boolean;
  error?: string;
  onApprove: () => void;
  onReject: (reason: string) => void;
};

/** Approve, or reject with a reason the person will see. */
export function ReviewPanel({ saving, error, onApprove, onReject }: Props) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();

  function reject() {
    if (reason.trim().length < 3) {
      setReasonError(t('admin.reasonRequired'));
      return;
    }
    setReasonError(undefined);
    onReject(reason.trim());
  }

  return (
    <View style={styles.panel}>
      <Button title={t('admin.approve')} loading={saving} onPress={onApprove} />
      <TextField
        label={t('admin.reasonLabel')}
        placeholder={t('admin.reasonPlaceholder')}
        value={reason}
        onChangeText={setReason}
        maxLength={300}
        multiline
        error={reasonError}
      />
      <Button title={t('admin.reject')} variant="secondary" disabled={saving} onPress={reject} />
      {error ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
