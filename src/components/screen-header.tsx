import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={onPress ?? (() => router.back())}
      hitSlop={8}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name="chevron-left" size={24} />
    </Pressable>
  );
}

type Props = {
  title?: string;
  /** Right side: "Step 1 of 3" text or a button. */
  right?: ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
};

/** Back button and title row used at the top of most screens. */
export function ScreenHeader({ title, right, onBack, hideBack }: Props) {
  return (
    <View style={styles.row}>
      {hideBack ? null : <BackButton onPress={onBack} />}
      {title ? (
        <Text variant="screenTitle" style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      {typeof right === 'string' ? (
        <Text variant="caption" muted>
          {right}
        </Text>
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  title: { flex: 1 },
});
