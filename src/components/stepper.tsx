import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fonts, radius } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

type Props = {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

/** "–  4.5 kg  +" */
export function Stepper({ value, min, max, step, unit, format = String, onChange }: Props) {
  return (
    <View style={styles.row}>
      <StepButton
        icon="minus"
        label={t('common.less')}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <View style={styles.value} accessibilityLiveRegion="polite">
        <Text style={styles.number}>{format(value)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <StepButton
        icon="plus"
        label={t('common.more')}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}
    >
      <Icon name={icon} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  number: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, color: colors.text },
  unit: { fontFamily: fonts.bold, fontSize: 20, color: colors.textMuted },
});
