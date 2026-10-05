import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon, type IconName } from './icon';

/** Square outlined button with only an icon (chat, settings). Always has a label for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 52,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
