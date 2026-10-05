import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { RadioCard } from '@/components/choice';
import { Icon } from '@/components/icon';
import { InfoBox } from '@/components/info-box';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useSession } from '@/features/auth/session';
import { useRaiseDispute } from '@/features/delivery/hooks';
import { useRequest } from '@/features/requests/hooks';
import { t } from '@/i18n';
import type { DisputeCategory } from '@/lib/database.types';
import { dbErrorMessage } from '@/lib/db-errors';
import { pickImage } from '@/lib/images';
import { colors, radius, spacing } from '@/theme';

const CATEGORIES: DisputeCategory[] = ['damaged', 'not_as_described', 'not_responding', 'other'];
const MAX_PHOTOS = 5;

/** Report a problem: payment stays frozen until Hopbag reviews it. */
export default function DisputeScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const me = useSession().session?.user.id;
  const request = useRequest(requestId).data;
  const raise = useRaiseDispute();
  const [category, setCategory] = useState<DisputeCategory>('damaged');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const iAmRequester = request?.requester_id === me;

  async function addPhoto() {
    const uri = await pickImage();
    if (uri) setPhotos((list) => [...list, uri].slice(0, MAX_PHOTOS));
  }

  function submit() {
    if (category === 'other' && reason.trim().length < 10) {
      return setError(t('dispute.reasonShort'));
    }
    setError(undefined);
    raise.mutate(
      { requestId, reason: reason.trim(), category, photoUris: photos },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('problem.submit')} loading={raise.isPending} onPress={submit} />
          <Text variant="caption" muted style={styles.center}>
            {t('problem.replies')}
          </Text>
        </>
      }
    >
      <ScreenHeader title={t('problem.title')} />
      <InfoBox icon="lock">
        {iAmRequester ? t('problem.frozen') : t('problem.frozenTraveler')}
      </InfoBox>

      <Text variant="label">{t('problem.whatWrong')}</Text>
      <View style={styles.group} accessibilityRole="radiogroup">
        {CATEGORIES.map((c) => (
          <RadioCard
            key={c}
            label={t(`problem.categories.${c}`)}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      <TextField
        label={t('problem.tell')}
        placeholder={t('problem.tellPlaceholder')}
        value={reason}
        onChangeText={setReason}
        maxLength={1000}
        multiline
        error={error}
        style={styles.reason}
      />

      {photos.length > 0 ? (
        <View style={styles.photos}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
          ))}
        </View>
      ) : null}
      {photos.length < MAX_PHOTOS ? (
        <Pressable accessibilityRole="button" onPress={addPhoto} style={styles.add}>
          <Icon name="camera" size={24} />
          <Text variant="bodyStrong">
            {photos.length > 0
              ? t('problem.photosAdded', { count: photos.length })
              : t('problem.addPhotos')}
          </Text>
        </Pressable>
      ) : null}

      {raise.error ? (
        <Text variant="body" style={styles.error}>
          {dbErrorMessage(raise.error, 'dispute.failed')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm + 2 },
  reason: { minHeight: 88, textAlignVertical: 'top' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 4,
  },
  center: { textAlign: 'center' },
  error: { color: colors.danger },
});
