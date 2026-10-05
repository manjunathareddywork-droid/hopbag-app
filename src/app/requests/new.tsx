import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingView } from '@/components/loading-view';
import { useCities, useStates } from '@/features/places/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useBlockedTerms, useCategories, useCreateRequest } from '@/features/requests/hooks';
import { CategoryStep } from '@/features/requests/new/category-step';
import { DetailsStep } from '@/features/requests/new/details-step';
import { ReviewStep } from '@/features/requests/new/review-step';
import { emptyRequestForm, type RequestFormValues } from '@/features/requests/schema';
import { useSettings } from '@/features/travelers/hooks';
import { t } from '@/i18n';
import { dbErrorMessage } from '@/lib/db-errors';
import { track } from '@/lib/monitoring';

type Step = 'category' | 'details' | 'review';

/**
 * Ask for an item in three steps: category, details, review.
 * Opened from Home with an item (search) or a traveler's route already filled in.
 */
export default function NewRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ item?: string; from?: string; to?: string }>();
  const categories = useCategories();
  const cities = useCities();
  const states = useStates();
  const blockedTerms = useBlockedTerms();
  const settings = useSettings();
  const { data: profile } = useMyProfile();
  const create = useCreateRequest();

  const [step, setStep] = useState<Step>('category');
  const [askCategory, setAskCategory] = useState(false);
  const [values, setValues] = useState<RequestFormValues>(() => ({
    ...emptyRequestForm,
    itemName: params.item ?? '',
    fromCityId: params.from ?? '',
    toCityId: params.to ?? (profile?.home_city_id ? String(profile.home_city_id) : ''),
  }));

  useEffect(() => {
    track('request_form_opened');
  }, []);

  const queries = [categories, cities, states, blockedTerms, settings];
  if (!categories.data || !cities.data || !states.data || !blockedTerms.data || !settings.data) {
    return (
      <LoadingView
        error={queries.some((q) => q.isError) ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    );
  }

  if (step === 'category') {
    return (
      <CategoryStep
        categories={categories.data}
        selected={values.categoryId}
        onPick={(categoryId) => {
          setValues((v) => ({ ...v, categoryId }));
          setAskCategory(false);
          setStep('details');
        }}
        onSomethingElse={() => {
          setAskCategory(true);
          setStep('details');
        }}
      />
    );
  }

  if (step === 'details') {
    return (
      <DetailsStep
        categories={categories.data}
        cities={cities.data}
        states={states.data}
        blockedTerms={blockedTerms.data}
        settings={settings.data}
        initial={values}
        askCategory={askCategory}
        onBack={(current) => {
          setValues(current);
          setStep('category');
        }}
        onReview={(checked) => {
          setValues(checked);
          setStep('review');
        }}
        onChooseAnother={() => {
          setValues((v) => ({ ...v, itemName: '', details: '' }));
          setStep('category');
        }}
        onSeeAllowed={() => router.push('/not-allowed')}
      />
    );
  }

  return (
    <ReviewStep
      values={values}
      categories={categories.data}
      cities={cities.data}
      feeBps={settings.data.platform_fee_bps}
      saving={create.isPending}
      saveError={create.error ? dbErrorMessage(create.error, 'requests.submitFailed') : undefined}
      onBack={() => setStep('details')}
      onPost={() =>
        create.mutate(values, {
          onSuccess: (created) => {
            track('request_posted', { category: created.category_id });
            router.replace({ pathname: '/requests/[id]', params: { id: created.id } });
          },
        })
      }
    />
  );
}
