import { screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { en } from '@/i18n/en';
import { renderWithQuery } from '@/test-utils';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/profile/hooks', () => ({
  useMyProfile: () => ({
    data: {
      full_name: 'Arjun Mehta',
      home_city_id: 1,
      home_state: 'TS',
      traveler_verified_at: null,
    },
  }),
}));
jest.mock('@/features/auth/session', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } } }),
}));
const mockSuspension: { current: { reason: string } | null } = { current: null };
jest.mock('@/features/safety/hooks', () => ({
  useSuspension: () => ({ data: mockSuspension.current }),
}));
const mockUnread = { current: 0 };
jest.mock('@/features/notifications/hooks', () => ({ useUnreadCount: () => mockUnread.current }));
jest.mock('@/features/places/hooks', () => ({
  useCities: () => ({
    data: [
      { id: 1, name: 'Hyderabad', state_code: 'TS' },
      { id: 2, name: 'Chennai', state_code: 'TN' },
    ],
  }),
  useStates: () => ({ data: [{ code: 'TS', name: 'Telangana' }] }),
}));
jest.mock('@/features/travelers/hooks', () => ({
  useMyVerification: () => ({ data: null }),
  useUpcomingTrips: () => ({
    isSuccess: true,
    data: [
      {
        trip_id: 't1',
        traveler_id: 'u2',
        traveler_name: 'Sneha I.',
        from_city_id: 2,
        to_city_id: 1,
        travel_date: '2026-10-09',
        mode: 'flight',
        free_grams: 4500,
        free_items: 2,
      },
    ],
  }),
}));

describe('HomeScreen', () => {
  it('greets the person and lists verified travelers coming to their city', async () => {
    await renderWithQuery(<HomeScreen />);

    expect(screen.getByText('Hi Arjun')).toBeTruthy();
    expect(screen.getByText(en.homeScreen.ask)).toBeTruthy();
    expect(screen.getByText(en.homeScreen.travelling)).toBeTruthy();
    expect(screen.getByText('Travelers coming to Hyderabad')).toBeTruthy();
    expect(screen.getByText('Sneha I. · Chennai to Hyderabad')).toBeTruthy();
    expect(screen.getByText('Fri 9 Oct · 4.5 kg free')).toBeTruthy();
  });

  it('shows unread updates on the bell', async () => {
    mockUnread.current = 3;
    await renderWithQuery(<HomeScreen />);
    expect(screen.getByLabelText('Updates (3)')).toBeTruthy();
    mockUnread.current = 0;
  });

  it('tells a suspended person why', async () => {
    mockSuspension.current = { reason: 'Asked for payment outside the app' };
    await renderWithQuery(<HomeScreen />);
    expect(
      screen.getByText(/Your account is suspended: Asked for payment outside the app/),
    ).toBeTruthy();
    mockSuspension.current = null;
  });
});
