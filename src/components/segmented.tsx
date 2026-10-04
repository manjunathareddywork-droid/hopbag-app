import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** "Active | Delivered | Cancelled" switch. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.option, active && styles.active]}
          >
            <Text style={[styles.text, active ? styles.textActive : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.greyTint,
    borderRadius: radius.md,
    padding: spacing.xs + 2,
  },
  option: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 4,
  },
  active: { backgroundColor: colors.surface },
  text: { fontFamily: fonts.medium, fontSize: 16, color: colors.textMuted },
  textActive: { fontFamily: fonts.bold, color: colors.text },
});
