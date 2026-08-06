import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'portclos.access_token';
const HOUSE_KEY = 'portclos.current_house_id';

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

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Local-dev sentinel used when AUTH_DISABLED is on. */
export function isLocalDevToken(token: string): boolean {
  return token === 'local-dev';
}

/**
 * Best-effort JWT exp check (no signature verify — API still validates).
 * Expired / unreadable tokens must not keep the user "logged in" forever.
 */
export function isAccessTokenExpired(token: string): boolean {
  if (isLocalDevToken(token)) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return true;
  }
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = globalThis.atob(b64 + pad);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') {
      return false;
    }
    // 30s clock skew
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

/** Stored token if present and not expired; clears SecureStore when expired. */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }
  if (isAccessTokenExpired(token)) {
    await setAccessToken(null);
    return null;
  }
  return token;
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
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

export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri(),
    client_id: authClientId(),
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(discovery().tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`token HTTP ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('token missing access_token');
  }
  return json.access_token;
}
