import { usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { reportScreen, wireApiErrorReporting } from '@/lib/telemetry';
import { useSession } from '@/providers/SessionProvider';

/** Records authenticated screen views (usage) without SaaS analytics. */
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { token, ready } = useSession();

  useEffect(() => {
    wireApiErrorReporting();
  }, []);

  useEffect(() => {
    if (!ready || !token || !pathname) return;
    reportScreen(pathname);
  }, [pathname, ready, token]);

  return <>{children}</>;
}
