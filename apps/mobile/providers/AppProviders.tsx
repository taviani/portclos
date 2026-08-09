import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';
import { SearchOverlayProvider } from '@/providers/SearchOverlayProvider';
import { SessionProvider } from '@/providers/SessionProvider';
import { TelemetryProvider } from '@/providers/TelemetryProvider';
import { PortclosPaperProvider } from '@/theme/paper';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PortclosPaperProvider>
        <SessionProvider>
          <TelemetryProvider>
            <SearchOverlayProvider>{children}</SearchOverlayProvider>
          </TelemetryProvider>
        </SessionProvider>
      </PortclosPaperProvider>
    </QueryClientProvider>
  );
}
