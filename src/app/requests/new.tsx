import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { useCities, useStates } from '@/features/places/hooks';
import { dbErrorMessage } from '@/lib/db-errors';
import { useBlockedTerms, useCategories, useCreateRequest } from '@/features/requests/hooks';
import { RequestForm } from '@/features/requests/request-form';
import { t } from '@/i18n';
import { track } from '@/lib/monitoring';

export default function NewRequestScreen() {
  const router = useRouter();
  const categories = useCategories();
  const cities = useCities();
  const blockedTerms = useBlockedTerms();
  const states = useStates();
  const create = useCreateRequest();

  useEffect(() => {
    track('request_form_opened');
  }, []);

  const queries = [categories, cities, blockedTerms, states];
  if (!categories.data || !cities.data || !blockedTerms.data || !states.data) {
    return (
      <LoadingView
        error={queries.some((q) => q.isError) ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    );
  }

  return (
    <Screen>
      <RequestForm
        categories={categories.data}
        cities={cities.data}
        blockedTerms={blockedTerms.data}
        states={states.data}
        saving={create.isPending}
        saveError={create.error ? dbErrorMessage(create.error, 'requests.submitFailed') : undefined}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (created) => {
              track('request_posted', { category: created.category_id });
              router.replace({ pathname: '/requests/[id]', params: { id: created.id } });
            },
          })
        }
      />
    </Screen>
  );
}
