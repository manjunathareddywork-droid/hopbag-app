import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/theme';

/** Teal-card progress line: start dot, orange travelled part, traveler marker, orange end. */
export function RouteProgress({ value }: { value: number }) {
  const pct = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as const;
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.track} />
      <View style={[styles.done, { width: pct }]} />
      <View style={[styles.dot, styles.start]} />
      <View style={[styles.dot, styles.end]} />
      <View style={[styles.marker, { left: pct }]}>
        <Icon name="navigation" size={14} color={colors.teal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 36, justifyContent: 'center', marginHorizontal: 8 },
  track: { height: 4, borderRadius: 2, backgroundColor: '#2C5A61' },
  done: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.orange },
  dot: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  start: { left: -8, backgroundColor: colors.white },
  end: { right: -8, backgroundColor: colors.orange },
  marker: {
    position: 'absolute',
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
