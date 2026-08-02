import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';
import { SessionProvider } from '@/providers/SessionProvider';
import { PortclosPaperProvider } from '@/theme/paper';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PortclosPaperProvider>
        <SessionProvider>{children}</SessionProvider>
      </PortclosPaperProvider>
    </QueryClientProvider>
  );
}
