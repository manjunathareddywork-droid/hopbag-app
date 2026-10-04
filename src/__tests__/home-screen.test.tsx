import { screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';
import { en } from '@/i18n/en';
import { renderWithQuery } from '@/test-utils';

const mockIsAdmin = { current: false };
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));
jest.mock('@/features/profile/hooks', () => ({
  useMyProfile: () => ({ data: { full_name: 'Bala Reddy' } }),
}));
jest.mock('@/features/admin/hooks', () => ({
  useIsAdmin: () => ({ data: mockIsAdmin.current }),
}));
const mockUnread = { current: 0 };
jest.mock('@/features/notifications/hooks', () => ({
  useUnreadCount: () => mockUnread.current,
}));

describe('HomeScreen', () => {
  it('shows the main actions to every signed-in user', async () => {
    mockIsAdmin.current = false;
    await renderWithQuery(<HomeScreen />);

    expect(screen.getByText('Hi, Bala')).toBeTruthy();
    expect(screen.getByText(en.home.newRequest)).toBeTruthy();
    expect(screen.getByText(en.home.myRequests)).toBeTruthy();
    expect(screen.getByText(en.home.travel)).toBeTruthy();
    expect(screen.getByText(en.home.account)).toBeTruthy();
    expect(screen.queryByText(en.admin.open)).toBeNull();
  });

  it('adds the admin entry for admins', async () => {
    mockIsAdmin.current = true;
    await renderWithQuery(<HomeScreen />);
    expect(screen.getByText(en.admin.open)).toBeTruthy();
  });

  it('shows how many updates are unread', async () => {
    mockUnread.current = 3;
    await renderWithQuery(<HomeScreen />);
    expect(screen.getByText('Updates (3)')).toBeTruthy();
  });
});
