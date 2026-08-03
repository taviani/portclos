import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';
import { SearchOverlayProvider } from '@/providers/SearchOverlayProvider';
import { SessionProvider } from '@/providers/SessionProvider';
import { PortclosPaperProvider } from '@/theme/paper';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PortclosPaperProvider>
        <SessionProvider>
          <SearchOverlayProvider>{children}</SearchOverlayProvider>
        </SessionProvider>
      </PortclosPaperProvider>
    </QueryClientProvider>
  );
}
