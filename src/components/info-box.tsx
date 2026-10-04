import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Tone = 'green' | 'warning' | 'neutral' | 'danger';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.greenTint, fg: colors.success },
  warning: { bg: colors.warningTint, fg: colors.peachText },
  neutral: { bg: colors.greyTint, fg: colors.text },
  danger: { bg: colors.dangerTint, fg: '#7A2410' },
};

/** Tinted note with an icon: "Nothing is charged now…", "Check the item before…". */
export function InfoBox({
  tone = 'green',
  icon,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={22} color={t.fg} /> : null}
      <View style={styles.flex}>
        {typeof children === 'string' ? (
          <Text variant="caption" style={{ color: t.fg === colors.success ? colors.text : t.fg }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md + 4,
    alignItems: 'flex-start',
  },
  flex: { flex: 1 },
});
