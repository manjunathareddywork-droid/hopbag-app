import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './text';

type Props = {
  label: string;
  /** Rupees (whole). */
  value: number;
  min: number;
  max: number;
  step?: number;
  valueText: string;
  minText: string;
  hint: string;
  onChange: (rupees: number) => void;
};

/** "Your carry fare  Rs 200" with a slider over the allowed band. */
export function FareSlider({
  label,
  value,
  min,
  max,
  step = 10,
  valueText,
  minText,
  hint,
  onChange,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text variant="label" style={styles.flex}>
          {label}
        </Text>
        <Text variant="label">{valueText}</Text>
      </View>
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{ text: valueText }}
        value={value}
        minimumValue={min}
        maximumValue={Math.max(max, min)}
        step={step}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor={colors.teal}
        maximumTrackTintColor={colors.tealTint}
        thumbTintColor={colors.orange}
        style={styles.slider}
      />
      <View style={styles.row}>
        <Text variant="caption" muted>
          {minText}
        </Text>
        <Text variant="caption" muted style={styles.hint}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  slider: { height: 40, marginHorizontal: -spacing.sm },
  hint: { flex: 1, textAlign: 'right' },
});
