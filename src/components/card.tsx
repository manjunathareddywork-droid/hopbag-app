import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** dark = teal hero card; selected = teal outline */
  tone?: 'default' | 'dark' | 'selected';
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** White rounded card with a soft border, the basic surface of every screen. */
export function Card({
  children,
  tone = 'default',
  padded = true,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const cardStyle = [styles.card, padded && styles.padded, styles[tone], style];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: { padding: spacing.md + 4 },
  default: {},
  dark: { backgroundColor: colors.teal, borderColor: colors.teal },
  selected: { borderColor: colors.teal, borderWidth: 2 },
  pressed: { opacity: 0.85 },
});
