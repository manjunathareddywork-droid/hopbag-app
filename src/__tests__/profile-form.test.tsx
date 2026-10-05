import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ProfileForm } from '@/features/profile/profile-form';
import { en } from '@/i18n/en';
import type { City, Profile } from '@/lib/database.types';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const states = [
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'TS', name: 'Telangana' },
];
const cities = [
  { id: 7, name: 'Proddatur', state_code: 'AP', aliases: [], is_active: true },
  { id: 9, name: 'Hyderabad', state_code: 'TS', aliases: ['Secunderabad'], is_active: true },
] as City[];

function renderForm(onSubmit = jest.fn(), profile: Profile | null = null) {
  return renderWithQuery(
    <ProfileForm
      profile={profile}
      cities={cities}
      states={states}
      submitLabel="Continue"
      saving={false}
      onSubmit={onSubmit}
    />,
  );
}

describe('ProfileForm', () => {
  it('shows clear errors when required fields are empty', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.press(screen.getByText('Continue'));

    expect(await screen.findByText(en.profile.errors.nameShort)).toBeTruthy();
    expect(screen.getByText(en.profile.errors.cityRequired)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the trimmed name and the chosen city', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.changeText(screen.getByLabelText(en.profile.nameLabel), ' Bala Reddy ');
    await fireEvent.press(screen.getByLabelText(en.profile.cityLabel));
    await fireEvent.changeText(screen.getByLabelText('Search'), 'secunderabad');
    await fireEvent.press(screen.getByText('Hyderabad, Telangana'));
    await fireEvent.press(screen.getByText(en.setup.intents.both));
    await fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      fullName: 'Bala Reddy',
      homeCityId: '9',
      photoUri: null,
      intent: 'both',
    });
  });

  it('asks an older profile without a city to choose one, keeping the name', async () => {
    const onSubmit = jest.fn();
    const legacy = { id: 'u1', full_name: 'Manjunatha Reddy', home_city_id: null } as Profile;
    await renderForm(onSubmit, legacy);

    expect(screen.getByDisplayValue('Manjunatha Reddy')).toBeTruthy();
    expect(screen.getByText(en.setup.addPhoto)).toBeTruthy();
    await fireEvent.press(screen.getByText('Continue'));
    expect(await screen.findByText(en.profile.errors.cityRequired)).toBeTruthy();
  });
});
