import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Fixed text shown before the input inside the box, e.g. "Rs". */
  prefix?: ReactNode;
  /** A separate box before the field, e.g. "+91" on the phone screen. */
  prefixBox?: string;
  /** Large number style (fare entry). */
  big?: boolean;
  /** Grey filled style used inside cards. */
  muted?: boolean;
};

/** Labelled input in the design style: white box, teal border when focused. */
export function TextField({
  label,
  error,
  hint,
  prefix,
  prefixBox,
  big,
  muted,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {prefixBox ? (
          <View style={[styles.box, styles.prefixBox]}>
            <Text variant="bodyStrong">{prefixBox}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.box,
            styles.flex,
            muted && styles.muted,
            big && styles.bigBox,
            focused && styles.focused,
            error ? styles.boxError : null,
          ]}
        >
          {prefix ? <Text style={[styles.prefix, big && styles.bigPrefix]}>{prefix}</Text> : null}
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, big && styles.bigInput, style]}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </View>
      </View>
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        typeof hint === 'string' ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : (
          hint
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm + 4 },
  flex: { flex: 1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
  },
  prefixBox: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
  muted: { backgroundColor: colors.surfaceMuted },
  bigBox: { minHeight: 76 },
  focused: { borderColor: colors.teal, borderWidth: 2, backgroundColor: colors.surface },
  boxError: { borderColor: colors.danger, borderWidth: 2 },
  prefix: { marginRight: spacing.sm, fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  bigPrefix: { fontSize: 26 },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.text,
    paddingVertical: spacing.sm + 2,
  },
  bigInput: { fontFamily: fonts.heading, fontSize: 36 },
  error: { color: colors.danger },
});
