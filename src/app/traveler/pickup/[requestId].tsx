import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CheckRow } from '@/components/choice';
import { IconTile } from '@/components/icon-tile';
import { InfoBox } from '@/components/info-box';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useDeclinePickup, useMarkPickedUp } from '@/features/delivery/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { firstName } from '@/features/profile/name';
import { useRequest } from '@/features/requests/hooks';
import { formatGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { pickImage, takePhoto } from '@/lib/images';
import { colors, radius, spacing } from '@/theme';

/** Before carrying: check the item, photograph it, or decline (full refund to the requester). */
export default function PickupScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const request = useRequest(requestId);
  const requester = useProfilesByIds(request.data ? [request.data.requester_id] : []).data?.[0];
  const pickup = useMarkPickedUp();
  const decline = useDeclinePickup();
  const [checks, setChecks] = useState({
    matches: false,
    packaging: false,
    weight: false,
    bill: false,
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  if (!request.data) {
    return (
      <LoadingView
        error={request.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => request.refetch()}
      />
    );
  }
  const r = request.data;
  const name = firstName(requester?.full_name);
  const weight = formatGrams(r.weight_grams);

  async function addPhoto() {
    const shot = await takePhoto();
    const uri = shot.uri ?? (shot.denied ? await pickImage() : null);
    if (uri) setPhoto(uri);
  }

  function confirm() {
    if (!checks.matches || !checks.packaging || !checks.weight || !photo) {
      return setError(t('pickup.checksRequired'));
    }
    setError(undefined);
    pickup.mutate(
      { requestId, photoUri: photo, weightGrams: r.weight_grams },
      {
        onSuccess: () =>
          router.replace({ pathname: '/traveler/deliver/[requestId]', params: { requestId } }),
      },
    );
  }

  function sendDecline() {
    if (reason.trim().length < 3) return setError(t('pickup.declineTitle'));
    setError(undefined);
    decline.mutate(
      { requestId, reason: reason.trim() },
      { onSuccess: () => router.dismissTo('/trips') },
    );
  }

  const set = (key: keyof typeof checks) => (value: boolean) =>
    setChecks((c) => ({ ...c, [key]: value }));
  const failure = pickup.error ?? decline.error;

  return (
    <Screen
      footer={
        declining ? (
          <>
            <Button
              title={t('pickup.declineYes')}
              variant="outline"
              loading={decline.isPending}
              onPress={sendDecline}
            />
            <Button title={t('offers.back')} variant="link" onPress={() => setDeclining(false)} />
          </>
        ) : (
          <>
            <Button title={t('pickup.confirm')} loading={pickup.isPending} onPress={confirm} />
            <Button
              title={t('pickup.decline')}
              variant="dangerLink"
              onPress={() => setDeclining(true)}
            />
          </>
        )
      }
    >
      <ScreenHeader title={t('pickup.title')} />
      <Text variant="body" muted>
        {t('pickup.intro')}
      </Text>

      {declining ? (
        <Card style={styles.group}>
          <Text variant="bodyStrong">{t('pickup.declineConfirm', { name })}</Text>
          <TextField
            label={t('pickup.declineTitle')}
            placeholder={t('pickup.declinePlaceholder')}
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            multiline
          />
        </Card>
      ) : (
        <>
          <Card style={styles.group}>
            <CheckRow
              label={t('pickup.matches', { item: r.item_name })}
              checked={checks.matches}
              onChange={set('matches')}
            />
            <CheckRow
              label={t('pickup.packaging')}
              checked={checks.packaging}
              onChange={set('packaging')}
            />
            <CheckRow
              label={t('pickup.weight', { weight })}
              checked={checks.weight}
              onChange={set('weight')}
            />
            <CheckRow label={t('pickup.bill')} checked={checks.bill} onChange={set('bill')} />
          </Card>

          <Card style={styles.row}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
            ) : (
              <IconTile name="camera" tone="tealTint" size={72} />
            )}
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('pickup.photo')}</Text>
              <Text variant="caption" muted>
                {t('pickup.photoHelp')}
              </Text>
            </View>
            <Button
              title={photo ? t('pickup.retake') : t('pickup.add')}
              variant="outline"
              onPress={addPhoto}
              style={styles.add}
            />
          </Card>
        </>
      )}

      {error || failure ? (
        <InfoBox tone="danger" icon="alert-circle">
          {error ?? dbErrorMessage(failure, 'delivery.pickupFailed')}
        </InfoBox>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  add: { minHeight: 48, paddingHorizontal: spacing.md },
});
