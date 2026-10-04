import { useQuery } from '@tanstack/react-query';

import { env } from '@/lib/env';

/** Pings Supabase Auth's health endpoint so the home screen can show we are connected. */
export function useServerHealth() {
  return useQuery({
    queryKey: ['server-health'],
    queryFn: async () => {
      const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
        headers: { apikey: env.supabasePublishableKey },
      });
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      return true;
    },
  });
}
