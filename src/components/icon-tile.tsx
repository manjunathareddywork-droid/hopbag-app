import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon, type IconName } from './icon';

type Tone = 'teal' | 'orange' | 'tealTint' | 'peach' | 'green' | 'blue' | 'grey';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  teal: { bg: colors.teal, fg: colors.orange },
  orange: { bg: colors.orange, fg: colors.teal },
  tealTint: { bg: colors.tealTint, fg: colors.teal },
  peach: { bg: colors.peachTint, fg: colors.teal },
  green: { bg: colors.greenTint, fg: colors.success },
  blue: { bg: colors.blueTint, fg: colors.blueText },
  grey: { bg: colors.greyTint, fg: colors.teal },
};

/** Rounded square with an icon (category, notification, quick action). */
export function IconTile({
  name,
  tone = 'tealTint',
  size = 56,
}: {
  name: IconName;
  tone?: Tone;
  size?: number;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size > 60 ? radius.lg : radius.md,
          backgroundColor: t.bg,
        },
      ]}
    >
      <Icon name={name} size={size * 0.45} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
