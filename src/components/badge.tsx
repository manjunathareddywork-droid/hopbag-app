import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

export type BadgeTone = 'green' | 'peach' | 'blue' | 'grey' | 'orange' | 'teal';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  green: { bg: colors.greenTint, fg: colors.success },
  peach: { bg: colors.peachTint, fg: colors.peachText },
  blue: { bg: colors.blueTint, fg: colors.blueText },
  grey: { bg: colors.greyTint, fg: colors.text },
  // Orange fill with teal text (never orange text).
  orange: { bg: colors.orange, fg: colors.teal },
  teal: { bg: colors.teal, fg: colors.white },
};

/** Small status pill: "Verified", "3 offers", "In transit", "Open". */
export function Badge({ label, tone = 'grey' }: { label: string; tone?: BadgeTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: 6,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
  },
});
