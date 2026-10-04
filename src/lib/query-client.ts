import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { reportError } from './monitoring';

export const queryClient = new QueryClient({
  // Unexpected failures are logged to app_errors (expected rule errors are skipped).
  queryCache: new QueryCache({ onError: (error) => reportError(error, { screen: 'query' }) }),
  mutationCache: new MutationCache({
    onError: (error) => reportError(error, { screen: 'mutation' }),
  }),
  defaultOptions: {
    queries: {
      // Mobile data can be slow and patchy; retry a little, do not hammer.
      retry: 2,
      staleTime: 30_000,
    },
  },
});
