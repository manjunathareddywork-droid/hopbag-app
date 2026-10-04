import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { Text } from '@/components/text';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { dbErrorMessage } from '@/lib/db-errors';
import {
  useCancelRequest,
  useCategories,
  useRequest,
  useRequestPhotoUrl,
} from '@/features/requests/hooks';
import { categoryText } from '@/features/requests/labels';
import { formatGrams } from '@/features/requests/weight';
import { t } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

const CANCELLABLE = ['draft', 'open', 'offered'];

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequest(id);
  const cities = useCities();
  const states = useStates();
  // Inactive categories are not in the active list; fall back to the stored id.
  const categories = useCategories();
  const photoUrl = useRequestPhotoUrl(request.data?.photo_path);
  const cancel = useCancelRequest();

  if (request.data === null) {
    return <LoadingView error={t('errors.notFound')} />;
  }
  if (!request.data || !cities.data) {
    return (
      <LoadingView
        error={request.isError || cities.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const r = request.data;
  const city = (cityId: number) =>
    cityLabel(
      cities.data.find((c) => c.id === cityId),
      states.data,
    );
  const category = categories.data?.find((c) => c.id === r.category_id);

  function confirmCancel() {
    Alert.alert(t('requests.cancelConfirm'), undefined, [
      { text: t('requests.keep'), style: 'cancel' },
      { text: t('requests.cancelYes'), style: 'destructive', onPress: () => cancel.mutate(r.id) },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <StatusChip status={r.status} />
        <Text variant="title">{r.item_name}</Text>
      </View>

      {photoUrl.data ? (
        <Image source={{ uri: photoUrl.data }} style={styles.photo} contentFit="cover" />
      ) : null}

      <View style={styles.card}>
        <DetailRow
          label={t('requests.fields.category')}
          value={category ? categoryText(category).name : r.category_id}
        />
        <DetailRow label={t('requests.fields.weight')} value={formatGrams(r.weight_grams)} />
        <DetailRow
          label={t('requests.fields.route')}
          value={t('requests.route', { from: city(r.from_city_id), to: city(r.to_city_id) })}
        />
        <DetailRow label={t('requests.fields.deadline')} value={formatDate(r.deadline)} />
        <DetailRow label={t('requests.fields.budget')} value={formatPaise(r.budget_paise)} />
        {r.details ? <DetailRow label={t('requests.fields.details')} value={r.details} /> : null}
      </View>

      {CANCELLABLE.includes(r.status) ? (
        <View style={styles.actions}>
          {cancel.error ? (
            <Text variant="body" style={styles.error}>
              {dbErrorMessage(cancel.error, 'requests.cancelFailed')}
            </Text>
          ) : null}
          <Button
            title={t('requests.cancelRequest')}
            variant="secondary"
            loading={cancel.isPending}
            onPress={confirmCancel}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
