import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isNetworkError, setTokenRefreshHandler, setUnauthorizedHandler } from '@/lib/api/http';
import { queryClient } from '@/lib/queryClient';
import {
  clearAllTokens,
  ensureFreshAccessToken,
  getAccessToken,
  setAccessToken,
  setCurrentHouseId,
  setRefreshToken,
  type TokenBundle,
} from '@/lib/auth';

type SessionContextValue = {
  token: string | null;
  ready: boolean;
  /** Persist access (+ optional refresh) after login / local-dev. */
  setSessionTokens: (bundle: TokenBundle | null) => Promise<void>;
  /** @deprecated Prefer setSessionTokens — access-only helper for local-dev. */
  setSessionToken: (token: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const setSessionTokens = useCallback(async (bundle: TokenBundle | null) => {
    if (!bundle) {
      await clearAllTokens();
      setToken(null);
      queryClient.clear();
      return;
    }
    await setAccessToken(bundle.accessToken);
    // Login: always replace refresh (null = issuer did not grant offline_access).
    await setRefreshToken(bundle.refreshToken);
    setToken(bundle.accessToken);
  }, []);

  const setSessionToken = useCallback(
    async (next: string | null) => {
      if (!next) {
        await setSessionTokens(null);
        return;
      }
      await setSessionTokens({ accessToken: next, refreshToken: null });
    },
    [setSessionTokens],
  );

  const signOut = useCallback(async () => {
    await setCurrentHouseId(null);
    await setSessionTokens(null);
  }, [setSessionTokens]);

  useEffect(() => {
    void (async () => {
      try {
        setToken(await ensureFreshAccessToken());
      } catch (err) {
        if (isNetworkError(err)) {
          setToken(await getAccessToken());
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Silent refresh when returning to the foreground.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void (async () => {
        try {
          const next = await ensureFreshAccessToken();
          if (next !== tokenRef.current) {
            setToken(next);
            if (!next) {
              queryClient.clear();
            }
          }
        } catch (err) {
          if (isNetworkError(err)) {
            return;
          }
        }
      })();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // HTTP layer: try refresh once on 401; only then sign out.
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      const next = await ensureFreshAccessToken();
      if (next) {
        setToken(next);
        return next;
      }
      return null;
    });
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => {
      setTokenRefreshHandler(null);
      setUnauthorizedHandler(null);
    };
  }, [signOut]);

  const value = useMemo(
    () => ({ token, ready, setSessionTokens, setSessionToken, signOut }),
    [token, ready, setSessionTokens, setSessionToken, signOut],
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
