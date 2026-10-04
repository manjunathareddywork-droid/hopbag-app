import { fireEvent, screen } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';
import { en } from '@/i18n/en';
import { supabase } from '@/lib/supabase';
import { renderWithQuery } from '@/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn() } },
}));

const signInWithOtp = supabase.auth.signInWithOtp as jest.Mock;

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks numbers that are not Indian mobiles', async () => {
    await renderWithQuery(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText(en.signIn.phoneLabel), '12345');
    await fireEvent.press(screen.getByText(en.signIn.sendCode));

    expect(screen.getByText(en.signIn.phoneInvalid)).toBeTruthy();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the code to the +91 number and opens the verify screen', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    await renderWithQuery(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText(en.signIn.phoneLabel), '98765 43210');
    await fireEvent.press(screen.getByText(en.signIn.sendCode));

    expect(signInWithOtp).toHaveBeenCalledWith({ phone: '+919876543210' });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/verify',
      params: { phone: '+919876543210' },
    });
  });

  it('shows a plain message when sending fails', async () => {
    signInWithOtp.mockResolvedValue({ error: new Error('boom') });
    await renderWithQuery(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText(en.signIn.phoneLabel), '9876543210');
    await fireEvent.press(screen.getByText(en.signIn.sendCode));

    expect(await screen.findByText(en.signIn.sendFailed)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
