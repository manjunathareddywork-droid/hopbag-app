import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'accent' | 'secondary' | 'outline' | 'link' | 'dangerLink';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: colors.white,
  accent: colors.teal, // teal on orange passes contrast; never orange text
  secondary: colors.text,
  outline: colors.text,
  link: colors.text,
  dangerLink: colors.danger,
};

/** Big, easy-to-hit buttons as in the designs. */
export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...rest
}: Props) {
  const inactive = disabled || loading;
  const isLink = variant === 'link' || variant === 'dangerLink';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        isLink ? styles.link : styles.base,
        styles[variant],
        (state.pressed || inactive) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={TEXT_COLOR[variant]} />
      ) : (
        <Text style={[styles.text, { color: TEXT_COLOR[variant] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: colors.teal },
  accent: { backgroundColor: colors.orange },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.teal },
  dangerLink: {},
  dimmed: { opacity: 0.55 },
  text: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
  },
});
