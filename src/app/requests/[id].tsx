import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailRow } from '@/components/detail-row';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { Text } from '@/components/text';
import { fareBand } from '@/features/offers/fare';
import { useAcceptOffer, useDeclineOffer, useOffersForRequest } from '@/features/offers/hooks';
import { OfferCard } from '@/features/offers/offer-card';
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
import { useProfilesByIds } from '@/features/profile/hooks';
import { useSettings } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import type { Offer } from '@/lib/database.types';
import { formatDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

// Before payment the requester can still cancel (Phase 5 adds payment).
const CANCELLABLE = ['draft', 'open', 'offered', 'accepted'];

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequest(id);
  const cities = useCities();
  const states = useStates();
  // Inactive categories are not in the active list; fall back to the stored id.
  const categories = useCategories();
  const photoUrl = useRequestPhotoUrl(request.data?.photo_path);
  const cancel = useCancelRequest();
  const offers = useOffersForRequest(id);
  const travelers = useProfilesByIds((offers.data ?? []).map((o) => o.traveler_id));
  const settings = useSettings();
  const accept = useAcceptOffer();
  const decline = useDeclineOffer();

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

  const visibleOffers = (offers.data ?? [])
    .filter((o) => o.status === 'pending' || o.status === 'accepted')
    .sort((a, b) => Number(b.status === 'accepted') - Number(a.status === 'accepted'));
  const band = settings.data ? fareBand(r.weight_grams, settings.data) : null;
  const takingOffers = r.status === 'open' || r.status === 'offered';
  const offerError = accept.error ?? decline.error;
  const travelerOf = (o: Offer) => travelers.data?.find((p) => p.id === o.traveler_id);

  function confirmAccept(o: Offer) {
    Alert.alert(
      t('offers.acceptConfirm', {
        name: travelerOf(o)?.full_name ?? '',
        amount: formatPaise(o.fare_paise),
      }),
      undefined,
      [
        { text: t('offers.back'), style: 'cancel' },
        { text: t('offers.acceptYes'), onPress: () => accept.mutate(o.id) },
      ],
    );
  }

  function confirmDecline(o: Offer) {
    Alert.alert(t('offers.declineConfirm'), undefined, [
      { text: t('offers.back'), style: 'cancel' },
      { text: t('offers.declineYes'), style: 'destructive', onPress: () => decline.mutate(o.id) },
    ]);
  }

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

      <View style={styles.offers}>
        <Text variant="heading">
          {r.status === 'accepted' ? t('offers.chosen') : t('offers.offersTitle')}
        </Text>
        {takingOffers && band ? (
          <Text variant="caption" muted>
            {t('offers.bandForRequest', {
              min: formatPaise(band.minPaise),
              max: formatPaise(band.maxPaise),
            })}
          </Text>
        ) : null}
        {visibleOffers.length === 0 && takingOffers ? (
          <Text variant="body" muted>
            {t('offers.noOffersYet')}
          </Text>
        ) : null}
        {offerError ? (
          <Text variant="body" style={styles.error}>
            {dbErrorMessage(offerError, 'offers.actionFailed')}
          </Text>
        ) : null}
        {visibleOffers.map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            traveler={travelerOf(o)}
            canRespond={r.status === 'offered'}
            busy={accept.isPending || decline.isPending}
            onAccept={() => confirmAccept(o)}
            onDecline={() => confirmDecline(o)}
          />
        ))}
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
  offers: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
