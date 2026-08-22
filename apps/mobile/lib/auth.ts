import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { isNetworkError, send } from '@/lib/api/http';

WebBrowser.maybeCompleteAuthSession();

const ACCESS_KEY = 'portclos.access_token';
const REFRESH_KEY = 'portclos.refresh_token';
const HOUSE_KEY = 'portclos.current_house_id';
const PKCE_KEY = 'portclos.pkce_verifier';

/** Refresh a bit before real exp so API calls rarely see a dead JWT. */
const EXPIRY_SKEW_MS = 60_000;

export type TokenBundle = {
  accessToken: string;
  refreshToken: string | null;
};

export function authIssuer(): string {
  const raw = process.env.EXPO_PUBLIC_AUTH_ISSUER?.trim();
  return (raw || 'https://auth.example.com').replace(/\/$/, '');
}

export function authClientId(): string {
  return process.env.EXPO_PUBLIC_AUTH_CLIENT_ID?.trim() || 'portclos';
}

export function isAuthConfigured(): boolean {
  const raw = process.env.EXPO_PUBLIC_AUTH_ISSUER?.trim() ?? '';
  return raw !== '' && !raw.includes('example.com');
}

export function redirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'portclos',
    path: 'auth/callback',
    native: 'portclos://auth/callback',
  });
}

export function discovery(): AuthSession.DiscoveryDocument {
  const issuer = authIssuer();
  return {
    authorizationEndpoint: `${issuer}/authorize`,
    tokenEndpoint: `${issuer}/token`,
    userInfoEndpoint: `${issuer}/userinfo`,
  };
}

/** Scopes for login — offline_access requests a refresh_token when the issuer allows it. */
export const AUTH_SCOPES = ['openid', 'email', 'offline_access'] as const;

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

/** Local-dev sentinel used when AUTH_DISABLED is on. */
export function isLocalDevToken(token: string): boolean {
  return token === 'local-dev';
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(globalThis.atob(b64 + pad)) as { exp?: number };
  } catch {
    return null;
  }
}

/**
 * True when the access token should be refreshed (expired or within skew).
 * Local-dev sentinel never expires.
 */
export function isAccessTokenExpired(token: string, skewMs = EXPIRY_SKEW_MS): boolean {
  if (isLocalDevToken(token)) {
    return false;
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return true;
  }
  if (typeof payload.exp !== 'number') {
    return false;
  }
  return payload.exp * 1000 <= Date.now() + skewMs;
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_KEY, token);
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

/** Persist or clear the full token bundle (access + optional refresh). */
export async function persistTokenBundle(bundle: TokenBundle | null): Promise<void> {
  if (!bundle) {
    await setAccessToken(null);
    await setRefreshToken(null);
    return;
  }
  await setAccessToken(bundle.accessToken);
  if (bundle.refreshToken) {
    await setRefreshToken(bundle.refreshToken);
  } else if (bundle.refreshToken === null) {
    // Explicit null from a refresh response that omitted rotation: keep existing refresh.
  }
}

export async function clearAllTokens(): Promise<void> {
  await setAccessToken(null);
  await setRefreshToken(null);
}

export async function getCurrentHouseId(): Promise<string | null> {
  return SecureStore.getItemAsync(HOUSE_KEY);
}

export async function setCurrentHouseId(id: string | null): Promise<void> {
  if (!id) {
    await SecureStore.deleteItemAsync(HOUSE_KEY);
    return;
  }
  await SecureStore.setItemAsync(HOUSE_KEY, id);
}

/** Persist PKCE verifier so /auth/callback can finish login if the in-memory request is gone. */
export async function setPkceVerifier(verifier: string | null): Promise<void> {
  if (!verifier) {
    await SecureStore.deleteItemAsync(PKCE_KEY);
    return;
  }
  await SecureStore.setItemAsync(PKCE_KEY, verifier);
}

export async function takePkceVerifier(): Promise<string | null> {
  const verifier = await SecureStore.getItemAsync(PKCE_KEY);
  if (verifier) {
    await SecureStore.deleteItemAsync(PKCE_KEY);
  }
  return verifier;
}

type TokenEndpointJson = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenBundle> {
  const res = await send(discovery().tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenEndpointJson;
  if (!res.ok || !json.access_token) {
    const detail = json.error || `token HTTP ${res.status}`;
    throw new Error(detail);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
  };
}

export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
}): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri(),
    client_id: authClientId(),
    code_verifier: params.codeVerifier,
  });
  return tokenRequest(body);
}

export async function refreshWithRefreshToken(refreshToken: string): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: authClientId(),
  });
  return tokenRequest(body);
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Return a usable access token: refresh silently when needed.
 * Single-flight so parallel API calls share one refresh.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const access = await getAccessToken();
  if (access && !isAccessTokenExpired(access)) {
    return access;
  }

  if (access && isLocalDevToken(access)) {
    return access;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) {
        if (access && isAccessTokenExpired(access)) {
          await clearAllTokens();
        }
        return null;
      }
      const bundle = await refreshWithRefreshToken(refresh);
      await setAccessToken(bundle.accessToken);
      // Rotate refresh when the issuer sends a new one; otherwise keep the old.
      if (bundle.refreshToken) {
        await setRefreshToken(bundle.refreshToken);
      }
      return bundle.accessToken;
    } catch (err) {
      if (isNetworkError(err)) {
        throw err;
      }
      await clearAllTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Boot helper: valid access, or silently refreshed, or null → login.
 * @deprecated Prefer ensureFreshAccessToken — kept name for call sites.
 */
export async function getValidAccessToken(): Promise<string | null> {
  return ensureFreshAccessToken();
}
