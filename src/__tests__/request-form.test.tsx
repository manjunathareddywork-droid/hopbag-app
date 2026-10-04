import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RequestForm } from '@/features/requests/request-form';
import { en } from '@/i18n/en';
import type { BlockedTerm, Category, City, State } from '@/lib/database.types';
import { addDays, todayIst } from '@/lib/dates';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

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
  { id: 2, name: 'Bengaluru', state_code: 'KA', aliases: ['Bangalore'], is_active: true },
  { id: 3, name: 'Mysuru', state_code: 'KA', aliases: ['Mysore'], is_active: true },
] as City[];
const states: State[] = [
  { code: 'TS', name: 'Telangana' },
  { code: 'KA', name: 'Karnataka' },
];
const blockedTerms: BlockedTerm[] = [{ id: 1, pattern: 'whiske?y', reason_code: 'alcohol' }];

function renderForm(onSubmit = jest.fn()) {
  return renderWithQuery(
    <RequestForm
      categories={categories}
      cities={cities}
      blockedTerms={blockedTerms}
      states={states}
      saving={false}
      onSubmit={onSubmit}
    />,
  );
}

async function chooseCity(label: string, search: string, option: string) {
  await fireEvent.press(screen.getByLabelText(label));
  await fireEvent.changeText(screen.getByLabelText('Search'), search);
  await fireEvent.press(screen.getByText(option));
}

async function fillValid(itemName = 'Filter coffee powder') {
  await fireEvent.press(screen.getByLabelText(en.requests.categoryLabel));
  await fireEvent.press(screen.getByText('Coffee and tea'));
  await fireEvent.changeText(screen.getByLabelText(en.requests.itemNameLabel), itemName);
  await fireEvent.changeText(screen.getByLabelText(en.requests.weightLabel), '1.5');
  await chooseCity(en.requests.fromLabel, 'Hyd', 'Hyderabad, Telangana');
  await chooseCity(en.requests.toLabel, 'Bangalore', 'Bengaluru, Karnataka');
  await fireEvent.press(screen.getByLabelText(en.requests.deadlineLabel));
  await fireEvent.changeText(screen.getByLabelText(en.requests.budgetLabel), '500');
}

describe('RequestForm', () => {
  it('submits a valid request', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fillValid();
    await fireEvent.press(screen.getByText(en.requests.submit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      categoryId: 'coffee_tea',
      itemName: 'Filter coffee powder',
      details: '',
      weightKg: '1.5',
      fromCityId: '1',
      toCityId: '2',
      deadline: mockDeadline,
      budgetRupees: '500',
      photoUri: null,
    });
  });

  it('explains why a blocked item cannot be posted', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fillValid('Old Monk and whisky');
    await fireEvent.press(screen.getByText(en.requests.submit));

    expect(
      await screen.findByText(
        `This item cannot be carried on Hopbag. ${en.blockedReasons.alcohol}`,
      ),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('finds cities by their old names', async () => {
    await renderForm();
    await fireEvent.press(screen.getByLabelText(en.requests.toLabel));
    await fireEvent.changeText(screen.getByLabelText('Search'), 'mysore');

    expect(screen.getByText('Mysuru, Karnataka')).toBeTruthy();
    expect(screen.queryByText('Hyderabad, Telangana')).toBeNull();
  });
});
