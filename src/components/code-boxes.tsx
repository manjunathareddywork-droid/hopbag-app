import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

type Props = {
  length: number;
  value: string;
  onChange?: (value: string) => void;
  /** Read-only display (the requester's code); last box orange like the design. */
  display?: boolean;
  accessibilityLabel: string;
  autoFocus?: boolean;
  onLight?: boolean;
};

/** One box per digit. In input mode a hidden field takes the typing (and SMS autofill). */
export function CodeBoxes({
  length,
  value,
  onChange,
  display = false,
  accessibilityLabel,
  autoFocus,
  onLight = true,
}: Props) {
  const input = useRef<TextInput>(null);
  const digits = value.split('');
  const boxes = Array.from({ length }, (_, i) => (
    <View
      key={i}
      style={[
        styles.box,
        display ? styles.displayBox : onLight ? styles.inputBox : styles.inputBoxMuted,
        display && i === length - 1 && styles.lastDisplay,
        !display && i === Math.min(digits.length, length - 1) && styles.activeBox,
      ]}
    >
      <Text style={[styles.digit, display && styles.displayDigit]}>{digits[i] ?? ''}</Text>
    </View>
  ));

  if (display) {
    return (
      <View style={styles.row} accessibilityLabel={`${accessibilityLabel}: ${digits.join(' ')}`}>
        {boxes}
      </View>
    );
  }
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel={accessibilityLabel}>
      <View style={styles.row} pointerEvents="none">
        {boxes}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={(v) => onChange?.(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm + 2, justifyContent: 'center' },
  box: {
    flex: 1,
    maxWidth: 72,
    aspectRatio: 0.85,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inputBoxMuted: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeBox: { borderColor: colors.teal, borderWidth: 2, backgroundColor: colors.surface },
  displayBox: { backgroundColor: colors.offWhite },
  lastDisplay: { backgroundColor: colors.orange },
  digit: { fontFamily: fonts.heading, fontSize: 30, color: colors.text },
  displayDigit: { fontSize: 46, lineHeight: 54 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
