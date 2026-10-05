import { useRouter } from 'expo-router';

import { LoadingView } from '@/components/loading-view';
import { useCities, useStates } from '@/features/places/hooks';
import { kgToGrams } from '@/features/requests/weight';
import { useCreateTrip, useSettings } from '@/features/travelers/hooks';
import { limitsFromSettings } from '@/features/travelers/schema';
import { TripForm } from '@/features/travelers/trip-form';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';

export default function NewTripScreen() {
  const router = useRouter();
  const cities = useCities();
  const states = useStates();
  const settings = useSettings();
  const create = useCreateTrip();

  const queries = [cities, states, settings];
  if (!cities.data || !states.data || !settings.data) {
    return (
      <LoadingView
        error={queries.some((q) => q.isError) ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    );
  }

  return (
    <TripForm
      cities={cities.data}
      states={states.data}
      limits={limitsFromSettings(settings.data)}
      saving={create.isPending}
      saveError={create.error ? dbErrorMessage(create.error, 'trips.submitFailed') : undefined}
      onSubmit={(values) =>
        create.mutate(
          {
            trip: {
              from_city_id: Number(values.fromCityId),
              to_city_id: Number(values.toCityId),
              travel_date: values.travelDate,
              mode: values.mode,
              capacity_grams: kgToGrams(values.capacityKg)!,
              max_items: Number(values.maxItems),
              pnr: values.pnr,
            },
            ticketUri: values.ticketUri,
          },
          {
            onSuccess: (trip) =>
              router.replace({ pathname: '/traveler/trips/[id]', params: { id: trip.id } }),
          },
        )
      }
    />
  );
}
