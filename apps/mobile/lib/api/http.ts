import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
};

type UnauthorizedHandler = () => void;
type TokenRefreshHandler = () => Promise<string | null>;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let tokenRefreshHandler: TokenRefreshHandler | null = null;

/** SessionProvider: clear session after refresh failed. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** SessionProvider: attempt silent refresh; return new access token or null. */
export function setTokenRefreshHandler(handler: TokenRefreshHandler | null): void {
  tokenRefreshHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}

export async function tryRefreshAccessToken(): Promise<string | null> {
  if (!tokenRefreshHandler) {
    return null;
  }
  return tokenRefreshHandler();
}

export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.apiUrl ?? 'http://localhost:8080').replace(/\/$/, '');
}

function withBearer(init: RequestInit | undefined, accessToken: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;
  let res = await fetch(url, init);

  if (res.status === 401 && tokenRefreshHandler) {
    const next = await tokenRefreshHandler();
    if (next) {
      res = await fetch(url, withBearer(init, next));
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      notifyUnauthorized();
    }
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchHealth(): Promise<{ status: string }> {
  return getJSON('/health');
}
