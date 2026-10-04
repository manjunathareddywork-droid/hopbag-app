import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

/** Thin bar: orange for form steps, teal for delivery progress. */
export function ProgressBar({
  value,
  tone = 'orange',
}: {
  value: number;
  tone?: 'orange' | 'teal';
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: tone === 'orange' ? colors.orange : colors.teal },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.tealTint,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
