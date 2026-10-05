import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DetailsStep } from '@/features/requests/new/details-step';
import { emptyRequestForm } from '@/features/requests/schema';
import { en } from '@/i18n/en';
import type { BlockedTerm, Category, City, State } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

const mockDeadline = addDays(todayIst(), 7);
jest.mock('@/components/date-field', () => ({
  DateField: ({ label, onChange }: { label: string; onChange: (d: string) => void }) => {
    const { Pressable } = jest.requireActual('react-native');
    return <Pressable accessibilityLabel={label} onPress={() => onChange(mockDeadline)} />;
  },
}));

const categories = [
  {
    id: 'coffee_tea',
    name: 'Coffee and tea',
    description: '',
    max_weight_grams: 3000,
    is_active: true,
    sort_order: 1,
  },
] as Category[];
const cities = [
  { id: 1, name: 'Hyderabad', state_code: 'TS', aliases: [], is_active: true },
  { id: 2, name: 'Chennai', state_code: 'TN', aliases: ['Madras'], is_active: true },
] as City[];
const states: State[] = [
  { code: 'TS', name: 'Telangana' },
  { code: 'TN', name: 'Tamil Nadu' },
];
const blockedTerms: BlockedTerm[] = [{ id: 1, pattern: 'tablets?', reason_code: 'medicine' }];
const settings = {
  fare_min_per_kg_paise: 5000,
  fare_max_per_kg_paise: 50000,
  fare_floor_paise: 5000,
};

function renderStep(onReview = jest.fn(), onChooseAnother = jest.fn()) {
  return renderWithQuery(
    <DetailsStep
      categories={categories}
      cities={cities}
      states={states}
      blockedTerms={blockedTerms}
      settings={settings}
      initial={{ ...emptyRequestForm, categoryId: 'coffee_tea', toCityId: '1' }}
      askCategory={false}
      onBack={jest.fn()}
      onReview={onReview}
      onChooseAnother={onChooseAnother}
      onSeeAllowed={jest.fn()}
    />,
  );
}

describe('Request details step', () => {
  it('confirms the item is allowed and passes a fare inside the band to review', async () => {
    const onReview = jest.fn();
    await renderStep(onReview);

    await fireEvent.changeText(
      screen.getByLabelText(en.newRequest.item),
      'Filter coffee powder, 500 g',
    );
    expect(screen.getByText('Allowed: Coffee and tea')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(en.newRequest.buyFrom));
    await fireEvent.changeText(screen.getByLabelText('Search'), 'madras');
    await fireEvent.press(screen.getByText('Chennai, Tamil Nadu'));
    await fireEvent.changeText(screen.getByLabelText(en.newRequest.weight), '0.5');
    await fireEvent.press(screen.getByLabelText(en.newRequest.neededBy));
    await fireEvent.changeText(screen.getByLabelText(en.newRequest.itemPrice), '320');

    // 0.5 kg: Rs 50 to Rs 250 (Rs 50 floor).
    expect(screen.getByText('Suggested band for 500 g: Rs 50 to Rs 250')).toBeTruthy();
    await fireEvent.press(screen.getByText(en.newRequest.review));

    await waitFor(() => expect(onReview).toHaveBeenCalled());
    expect(onReview.mock.calls[0][0]).toMatchObject({
      categoryId: 'coffee_tea',
      itemName: 'Filter coffee powder, 500 g',
      fromCityId: '2',
      toCityId: '1',
      weightKg: '0.5',
      deadline: mockDeadline,
      itemPriceRupees: '320',
      budgetRupees: '150',
    });
  });

  it('explains a blocked item straight away and offers another choice', async () => {
    const onChooseAnother = jest.fn();
    await renderStep(jest.fn(), onChooseAnother);

    await fireEvent.changeText(
      screen.getByLabelText(en.newRequest.item),
      'Ayurvedic tablets, 2 strips',
    );

    expect(screen.getByText(en.newRequest.blockedTitle)).toBeTruthy();
    expect(screen.getByText(en.blockedReasons.medicine)).toBeTruthy();
    expect(screen.queryByText(en.newRequest.review)).toBeNull();
    await fireEvent.press(screen.getByText(en.newRequest.chooseAnother));
    expect(onChooseAnother).toHaveBeenCalled();
  });
});
