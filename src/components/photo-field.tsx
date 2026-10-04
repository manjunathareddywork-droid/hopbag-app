import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { pickImage, takePhoto } from '@/lib/images';
import { colors, radius, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Props = {
  label: string;
  tip?: string;
  value: string | null;
  onChange: (uri: string) => void;
  error?: string;
};

/** Photo of a document or item: take one with the camera or choose from the gallery. */
export function PhotoField({ label, tip, value, onChange, error }: Props) {
  const [cameraDenied, setCameraDenied] = useState(false);

  async function fromCamera() {
    const { uri, denied } = await takePhoto();
    setCameraDenied(denied);
    if (uri) onChange(uri);
  }

  async function fromGallery() {
    const uri = await pickImage();
    if (uri) onChange(uri);
  }

  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      {tip ? (
        <Text variant="caption" muted>
          {tip}
        </Text>
      ) : null}
      {value ? (
        <Image
          source={{ uri: value }}
          style={styles.preview}
          contentFit="contain"
          accessibilityLabel={label}
        />
      ) : null}
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button
            title={value ? t('photo.retake') : t('photo.take')}
            variant="secondary"
            onPress={fromCamera}
          />
        </View>
        <View style={styles.button}>
          <Button title={t('photo.choose')} variant="secondary" onPress={fromGallery} />
        </View>
      </View>
      {cameraDenied ? (
        <Text variant="caption" muted>
          {t('photo.cameraDenied')}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    flexGrow: 1,
    minWidth: 140,
  },
  error: {
    color: colors.danger,
  },
});
