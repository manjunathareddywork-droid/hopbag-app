import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** A white card holding rows separated by hairlines. */
export function MenuGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

type RowProps = {
  label: string;
  icon?: IconName;
  value?: string;
  right?: ReactNode;
  danger?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  last?: boolean;
};

export function MenuRow({
  label,
  icon,
  value,
  right,
  danger,
  chevron = true,
  onPress,
  last,
}: RowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={24} /> : null}
      <Text variant="bodyStrong" style={[styles.label, danger && styles.danger]}>
        {label}
      </Text>
      {value ? (
        <Text variant="body" muted>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && chevron && !right ? (
        <Icon name="chevron-right" size={22} color={colors.textSubtle} />
      ) : null}
    </Pressable>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Text variant="bodyStrong" style={styles.label}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.teal, false: colors.border }}
        thumbColor={colors.offWhite}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md + 4,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { flex: 1 },
  danger: { color: colors.danger },
});
