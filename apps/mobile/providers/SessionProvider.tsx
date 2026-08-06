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
import {
  getValidAccessToken,
  setAccessToken,
  setCurrentHouseId,
} from '@/lib/auth';
import { setUnauthorizedHandler } from '@/lib/api/http';

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

  useEffect(() => {
    void (async () => {
      try {
        setToken(await getValidAccessToken());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // API 401 (expired/revoked JWT) → clear session so user is not stuck
  // "logged in" with a dead token until they manually disconnect.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

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
