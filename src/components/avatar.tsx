import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Text } from './text';

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
};

/** "Sneha Iyer" -> "SI", "Sneha I." -> "SI", "Xavier" -> "X". */
export function initials(name = ''): string {
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
  return (
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.[0] ?? '')
  ).toUpperCase();
}

/** Peach or light-teal circle with initials (stable per name), or the photo. */
export function Avatar({ uri, name, size = 56 }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.image, shape]} contentFit="cover" />;
  }
  const code = (name ?? '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <View
      style={[
        styles.circle,
        shape,
        { backgroundColor: code % 2 ? colors.tealTint : colors.peachTint },
      ]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: colors.text }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  circle: { alignItems: 'center', justifyContent: 'center' },
});
