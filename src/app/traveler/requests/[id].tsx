import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { Text } from '@/components/text';
import { fareBand } from '@/features/offers/fare';
import { useMakeOffer, useOffersForRequest, useWithdrawOffer } from '@/features/offers/hooks';
import { OfferForm } from '@/features/offers/offer-form';
import { useCities, useStates } from '@/features/places/hooks';
import { cityLabel } from '@/features/places/labels';
import { useCategories, useRequest, useRequestPhotoUrl } from '@/features/requests/hooks';
import { categoryText } from '@/features/requests/labels';
import { formatGrams } from '@/features/requests/weight';
import { useSettings } from '@/features/travelers/hooks';
import { t, type StringKey } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

/** A request as a traveler sees it, with their offer (or the form to make one). */
export default function TravelerRequestScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const request = useRequest(id);
  const offers = useOffersForRequest(id);
  const cities = useCities();
  const states = useStates();
  const categories = useCategories();
  const settings = useSettings();
  const photo = useRequestPhotoUrl(request.data?.photo_path);
  const make = useMakeOffer();
  const withdraw = useWithdrawOffer();

  if (request.data === null) return <LoadingView error={t('errors.notFound')} />;
  if (!request.data || !cities.data || !offers.data || !settings.data) {
    const failed = request.isError || cities.isError || offers.isError || settings.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          request.refetch();
          offers.refetch();
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
  const band = fareBand(r.weight_grams, settings.data);
  // RLS shows a traveler only their own offers on this request; newest first.
  const mine = [...offers.data].reverse()[0];
  const open = r.status === 'open' || r.status === 'offered';

  return (
    <Screen>
      <View style={styles.header}>
        <StatusChip status={r.status} />
        <Text variant="title">{r.item_name}</Text>
      </View>

      {photo.data ? (
        <Image source={{ uri: photo.data }} style={styles.photo} contentFit="cover" />
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
        {r.item_price_paise !== null ? (
          <DetailRow
            label={t('requests.fields.itemPrice')}
            value={formatPaise(r.item_price_paise)}
          />
        ) : null}
        <DetailRow label={t('requests.fields.budget')} value={formatPaise(r.budget_paise)} />
        {r.details ? <DetailRow label={t('requests.fields.details')} value={r.details} /> : null}
      </View>

      {mine && mine.status !== 'withdrawn' ? (
        <View style={[styles.card, styles.inner]}>
          <Text variant="heading">
            {t('offers.yourOffer', { amount: formatPaise(mine.fare_paise) })}
          </Text>
          <Text variant="body" muted>
            {t(`offers.status.${mine.status}` as StringKey)}
          </Text>
          {mine.status === 'pending' ? (
            <>
              {withdraw.error ? (
                <Text variant="body" style={styles.error}>
                  {dbErrorMessage(withdraw.error, 'offers.withdrawFailed')}
                </Text>
              ) : null}
              <Button
                title={t('offers.withdraw')}
                variant="secondary"
                loading={withdraw.isPending}
                onPress={() => withdraw.mutate(mine.id)}
              />
            </>
          ) : null}
        </View>
      ) : open && tripId ? (
        <OfferForm
          minPaise={band.minPaise}
          maxPaise={band.maxPaise}
          saving={make.isPending}
          saveError={make.error ? dbErrorMessage(make.error, 'offers.sendFailed') : undefined}
          onSubmit={({ farePaise, message }) =>
            make.mutate({ requestId: r.id, tripId, farePaise, message })
          }
        />
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
  inner: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
});
