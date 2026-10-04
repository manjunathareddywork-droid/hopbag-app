import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile data can be slow and patchy; retry a little, do not hammer.
      retry: 2,
      staleTime: 30_000,
    },
  },
});
