/**
 * Public config read from .env. Only EXPO_PUBLIC_* values reach the app bundle, so
 * nothing secret may ever go here (no service role key, no Razorpay secret).
 *
 * Expo inlines these at build time and needs the full `process.env.EXPO_PUBLIC_X`
 * expression, so do not destructure process.env.
 */
export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function readEnv(source: Record<string, string | undefined>): Env {
  const values = {
    EXPO_PUBLIC_SUPABASE_URL: source.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Missing env: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`,
    );
  }
  return {
    supabaseUrl: values.EXPO_PUBLIC_SUPABASE_URL!,
    supabasePublishableKey: values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}

export const env = readEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
