import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HomeScreen from '@/app/index';
import { en } from '@/i18n/en';

// gcTime: Infinity stops React Query from leaving cache timers running after tests.
async function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('HomeScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the tagline and reports a working connection', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    await renderWithQuery(<HomeScreen />);

    expect(screen.getByText(en.home.tagline)).toBeTruthy();
    expect(await screen.findByText(en.home.serverOk)).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test-project.supabase.co/auth/v1/health',
      expect.objectContaining({ headers: { apikey: 'sb_publishable_test' } }),
    );
  });

  it('shows a plain error when the server cannot be reached', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await renderWithQuery(<HomeScreen />);

    expect(await screen.findByText(en.home.serverError)).toBeTruthy();
  });
});
