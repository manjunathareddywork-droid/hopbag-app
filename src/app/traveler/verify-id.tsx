import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChoiceChip } from '@/components/choice';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useSubmitVerification } from '@/features/travelers/hooks';
import { ID_TYPES } from '@/features/travelers/schema';
import { t } from '@/i18n';
import type { IdDocumentType } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { pickImage, takePhoto } from '@/lib/images';
import { colors, fonts, radius, spacing } from '@/theme';

/** Become a traveler: phone (done), a government ID photo, then the ticket with each trip. */
export default function VerifyIdScreen() {
  const router = useRouter();
  const submit = useSubmitVerification();
  const [idType, setIdType] = useState<IdDocumentType>('aadhaar');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [cameraDenied, setCameraDenied] = useState(false);

  async function addPhoto() {
    const shot = await takePhoto();
    setCameraDenied(shot.denied);
    const uri = shot.uri ?? (shot.denied ? await pickImage() : null);
    if (uri) setPhoto(uri);
  }

  function send() {
    if (!photo) return setError(t('verifyId.photoRequired'));
    setError(undefined);
    submit.mutate(
      { idType, photoUri: photo },
      { onSuccess: () => router.replace('/traveler/status') },
    );
  }

  return (
    <Screen
      footer={
        <Button title={t('becomeTraveler.submit')} loading={submit.isPending} onPress={send} />
      }
    >
      <ScreenHeader title={t('becomeTraveler.title')} />
      <Text variant="body" muted>
        {t('becomeTraveler.intro')}
      </Text>

      <Card style={styles.row}>
        <View style={[styles.step, styles.stepDone]}>
          <Icon name="check" size={18} color={colors.white} />
        </View>
        <Text variant="bodyStrong">{t('becomeTraveler.phoneVerified')}</Text>
      </Card>

      <Card tone="selected" style={styles.group}>
        <View style={styles.row}>
          <View style={styles.step}>
            <Text style={styles.stepText}>2</Text>
          </View>
          <Text variant="bodyStrong">{t('becomeTraveler.govId')}</Text>
        </View>
        <Text variant="caption" muted>
          {t('becomeTraveler.govIdHelp')}
        </Text>
        <View style={styles.chips}>
          {ID_TYPES.map((id) => (
            <ChoiceChip
              key={id}
              label={t(`idTypes.${id}`)}
              selected={idType === id}
              onPress={() => setIdType(id)}
            />
          ))}
        </View>
        {idType === 'aadhaar' ? (
          <Text variant="caption" muted>
            {t('verifyId.aadhaarTip')}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={addPhoto} style={styles.upload}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.preview} contentFit="contain" />
          ) : (
            <>
              <Icon name="camera" size={26} />
              <Text variant="bodyStrong">{t('becomeTraveler.takeOrUpload')}</Text>
            </>
          )}
        </Pressable>
        {photo ? (
          <Button
            title={t('photo.choose')}
            variant="link"
            onPress={async () => {
              const uri = await pickImage();
              if (uri) setPhoto(uri);
            }}
          />
        ) : null}
        {cameraDenied ? (
          <Text variant="caption" muted>
            {t('photo.cameraDenied')}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.group}>
        <View style={styles.row}>
          <View style={[styles.step, styles.stepTodo]}>
            <Text style={[styles.stepText, styles.stepTodoText]}>3</Text>
          </View>
          <Text variant="bodyStrong">{t('becomeTraveler.ticketStep')}</Text>
        </View>
        <Text variant="caption" muted>
          {t('becomeTraveler.ticketStepHelp')}
        </Text>
      </Card>

      {error || submit.error ? (
        <Text variant="body" style={styles.error} accessibilityLiveRegion="polite">
          {error ?? dbErrorMessage(submit.error, 'verifyId.submitFailed')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  group: { gap: spacing.md - 4 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: { backgroundColor: colors.success },
  stepTodo: { backgroundColor: colors.tealTint },
  stepText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  stepTodoText: { color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  upload: {
    minHeight: 120,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textSubtle,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 180 },
  error: { color: colors.danger },
});
