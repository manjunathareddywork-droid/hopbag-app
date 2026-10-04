import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Text } from './text';

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
};

/** Round photo, or the person's initial on teal when there is no photo. */
export function Avatar({ uri, name, size = 96 }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.image, shape]} contentFit="cover" />;
  }
  const initial = name?.trim().charAt(0).toUpperCase() ?? '';
  return (
    <View style={[styles.placeholder, shape]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.4, color: colors.textOnDark }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.border,
  },
  placeholder: {
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
