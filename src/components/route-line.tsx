import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './text';

type Props = {
  from: string;
  to: string;
  /** light = on a teal background */
  light?: boolean;
  size?: 'md' | 'lg';
};

/** The little arc between two cities: "Chennai ⌒ Hyderabad". */
export function RouteArc({ light = false }: { light?: boolean }) {
  const stroke = light ? colors.white : colors.teal;
  return (
    <View style={styles.arcBox} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.arc, { borderColor: stroke }]} />
      <View style={[styles.dot, styles.dotStart, { backgroundColor: stroke }]} />
      <View style={[styles.dot, styles.dotEnd]} />
    </View>
  );
}

export function RouteLine({ from, to, light = false, size = 'md' }: Props) {
  const color = light ? colors.white : colors.text;
  const variant = size === 'lg' ? 'heading' : 'bodyStrong';
  return (
    <View style={styles.row} accessibilityLabel={`${from} to ${to}`}>
      <Text variant={variant} style={{ color }}>
        {from}
      </Text>
      <RouteArc light={light} />
      <Text variant={variant} style={{ color }}>
        {to}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  arcBox: { width: 72, height: 18, justifyContent: 'flex-end' },
  arc: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 2,
    height: 28,
    borderWidth: 3,
    borderRadius: 40,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, bottom: 1 },
  dotStart: { left: 2 },
  dotEnd: { right: 2, backgroundColor: colors.orange },
});
