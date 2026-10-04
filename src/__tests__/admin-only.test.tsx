import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdminOnly } from '@/features/admin/admin-only';
import { en } from '@/i18n/en';
import { renderWithQuery } from '@/test-utils';

const mockAdmin: { data: boolean | undefined } = { data: undefined };
jest.mock('@/features/admin/hooks', () => ({
  useIsAdmin: () => ({ data: mockAdmin.data, isError: false, refetch: jest.fn() }),
}));

describe('AdminOnly', () => {
  it('shows admin screens to admins', async () => {
    mockAdmin.data = true;
    await renderWithQuery(
      <AdminOnly>
        <Text>Secret admin list</Text>
      </AdminOnly>,
    );
    expect(screen.getByText('Secret admin list')).toBeTruthy();
  });

  it('tells everyone else it is for admins only', async () => {
    mockAdmin.data = false;
    await renderWithQuery(
      <AdminOnly>
        <Text>Secret admin list</Text>
      </AdminOnly>,
    );
    expect(screen.queryByText('Secret admin list')).toBeNull();
    expect(screen.getByText(en.errors.adminsOnly)).toBeTruthy();
  });

  it('waits while the check is loading', async () => {
    mockAdmin.data = undefined;
    await renderWithQuery(
      <AdminOnly>
        <Text>Secret admin list</Text>
      </AdminOnly>,
    );
    expect(screen.queryByText('Secret admin list')).toBeNull();
  });
});
