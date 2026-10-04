import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { formatPaise, rupeesToPaise } from '@/lib/money';
import { colors, spacing } from '@/theme';

type Props = {
  minPaise: number;
  maxPaise: number;
  saving: boolean;
  saveError?: string;
  onSubmit: (values: { farePaise: number; message: string }) => void;
};

/** Checks the fare against the band before sending; the database checks it again. */
export function validateFare(input: string, minPaise: number, maxPaise: number): string | null {
  const paise = rupeesToPaise(input);
  if (paise === null) return t('offers.fareInvalid');
  if (paise < minPaise || paise > maxPaise) {
    return t('offers.fareOutOfBand', { min: formatPaise(minPaise), max: formatPaise(maxPaise) });
  }
  return null;
}

export function OfferForm({ minPaise, maxPaise, saving, saveError, onSubmit }: Props) {
  const [fare, setFare] = useState('');
  const [message, setMessage] = useState('');
  const [fareError, setFareError] = useState<string>();
  const band = { min: formatPaise(minPaise), max: formatPaise(maxPaise) };

  function send() {
    const problem = validateFare(fare, minPaise, maxPaise);
    setFareError(problem ?? undefined);
    if (!problem) onSubmit({ farePaise: rupeesToPaise(fare)!, message: message.trim() });
  }

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <TextField
          label={t('offers.fareLabel')}
          prefix="₹"
          keyboardType="number-pad"
          value={fare}
          onChangeText={setFare}
          error={fareError}
        />
        <Text variant="caption" muted>
          {t('offers.fareHint', band)}
        </Text>
      </View>
      <TextField
        label={`${t('offers.messageLabel')} ${t('common.optional')}`}
        placeholder={t('offers.messagePlaceholder')}
        value={message}
        onChangeText={setMessage}
        maxLength={300}
        multiline
      />
      {saveError ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
      <Button title={t('offers.send')} loading={saving} onPress={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
  },
});
