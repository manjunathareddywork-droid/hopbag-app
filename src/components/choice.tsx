import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** Radio option as a full-width card: "UPI · GPay, PhonePe, Paytm". */
export function RadioCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant={selected ? 'bodyStrong' : 'body'}>{label}</Text>
        {description ? (
          <Text variant="caption" muted>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Square teal checkbox with a label. */
export function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Icon name="check" size={18} color={colors.white} /> : null}
      </View>
      <View style={styles.flex}>
        {typeof label === 'string' ? <Text variant="body">{label}</Text> : label}
      </View>
    </Pressable>
  );
}

/** Pill chip that toggles: rating tags, "Get items / Carry items / Both". */
export function ChoiceChip({
  label,
  selected,
  onPress,
  size = 'md',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'md' | 'lg';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        size === 'lg' ? styles.chipLg : styles.chip,
        selected && (size === 'lg' ? styles.chipLgSelected : styles.chipSelected),
      ]}
    >
      <Text
        variant={selected ? 'label' : 'caption'}
        style={[
          styles.chipText,
          size === 'lg' && styles.chipTextLg,
          selected && size === 'md' ? styles.chipTextOn : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.md - 2,
  },
  cardSelected: { borderColor: colors.teal, borderWidth: 2 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#94A7AB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.teal, backgroundColor: colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A7AB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  chip: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  chipLg: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipLgSelected: { borderColor: colors.teal, borderWidth: 2 },
  chipText: { color: colors.text },
  chipTextLg: { fontSize: 16 },
  chipTextOn: { color: colors.white },
});
