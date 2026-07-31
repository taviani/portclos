import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { queryClient } from '@/lib/queryClient';
import { getAccessToken, setAccessToken, setCurrentHouseId } from '@/lib/auth';

type SessionContextValue = {
  token: string | null;
  ready: boolean;
  setSessionToken: (token: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setToken(await getAccessToken());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setSessionToken = useCallback(async (next: string | null) => {
    await setAccessToken(next);
    setToken(next);
    if (!next) {
      queryClient.clear();
    }
  }, []);

  const signOut = useCallback(async () => {
    await setCurrentHouseId(null);
    await setSessionToken(null);
  }, [setSessionToken]);

  const value = useMemo(
    () => ({ token, ready, setSessionToken, signOut }),
    [token, ready, setSessionToken, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
