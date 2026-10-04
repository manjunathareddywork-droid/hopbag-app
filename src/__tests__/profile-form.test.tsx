import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ProfileForm } from '@/features/profile/profile-form';
import { en } from '@/i18n/en';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const states = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'TS', name: 'Telangana' },
];

function renderForm(onSubmit = jest.fn()) {
  return renderWithQuery(
    <ProfileForm
      profile={null}
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
    expect(screen.getByText(en.profile.errors.stateRequired)).toBeTruthy();
    expect(screen.getByText(en.profile.errors.cityShort)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values with the chosen state', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.changeText(screen.getByLabelText(en.profile.nameLabel), ' Bala Reddy ');
    await fireEvent.press(screen.getByLabelText(en.profile.stateLabel));
    await fireEvent.press(screen.getByText('Telangana'));
    await fireEvent.changeText(screen.getByLabelText(en.profile.cityLabel), 'Hyderabad ');
    await fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      fullName: 'Bala Reddy',
      homeState: 'TS',
      homeCity: 'Hyderabad',
      photoUri: null,
    });
  });
});
