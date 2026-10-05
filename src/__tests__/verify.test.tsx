import { fireEvent, screen } from '@testing-library/react-native';

import VerifyScreen from '@/app/verify';
import { en } from '@/i18n/en';
import { supabase } from '@/lib/supabase';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ phone: '+919876543210' }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn() } },
}));

const verifyOtp = supabase.auth.verifyOtp as jest.Mock;

describe('VerifyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the number the code was sent to', async () => {
    await renderWithQuery(<VerifyScreen />);
    expect(screen.getByText(/Sent to \+91 98765 43210\./)).toBeTruthy();
  });

  it('verifies automatically once 6 digits are entered', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    await renderWithQuery(<VerifyScreen />);

    await fireEvent.changeText(screen.getByLabelText(en.verify.codeLabel), '123456');

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      token: '123456',
      type: 'sms',
    });
  });

  it('tells the user when the code is wrong', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('Token has expired or is invalid') });
    await renderWithQuery(<VerifyScreen />);

    await fireEvent.changeText(screen.getByLabelText(en.verify.codeLabel), '000000');

    expect(await screen.findByText(en.verify.wrongCode)).toBeTruthy();
  });

  it('does not allow resending before the countdown ends', async () => {
    await renderWithQuery(<VerifyScreen />);
    expect(screen.getByText('Resend code in 0:30')).toBeTruthy();
    expect(screen.getByRole('button', { name: en.auth.resend })).toBeDisabled();
  });
});
