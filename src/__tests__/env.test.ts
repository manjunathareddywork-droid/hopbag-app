import { readEnv } from '@/lib/env';

describe('readEnv', () => {
  it('returns config when all values are present', () => {
    expect(
      readEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabasePublishableKey: 'sb_publishable_x' });
  });

  it('names every missing value', () => {
    expect(() => readEnv({})).toThrow(
      'Missing env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  });
});
