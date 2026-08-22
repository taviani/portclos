import { QueryClient } from '@tanstack/react-query';

import { isNetworkError } from '@/lib/api/http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        isNetworkError(error) ? failureCount < 2 : failureCount < 1,
    },
  },
});
