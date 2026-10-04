import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

/** "4.9 / Rating" */
export function Stat({
  value,
  label,
  boxed = false,
}: {
  value: string;
  label: string;
  boxed?: boolean;
}) {
  return (
    <View style={[styles.stat, boxed && styles.boxed]}>
      <Text style={styles.value}>{value}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  boxed: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  value: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: colors.text },
});
