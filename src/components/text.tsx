import { Text as RNText, type TextProps } from 'react-native';

import { colors, typography } from '@/theme';

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
};

/** App text in DM Sans. Use this instead of React Native's Text. */
export function Text({ variant = 'body', muted = false, style, ...rest }: Props) {
  return (
    <RNText
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    />
  );
}
