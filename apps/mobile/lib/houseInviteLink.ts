import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';

const PENDING_KEY = 'portclos.pending_house_invite_token';

/** True when the URL is a house-invite deep link (portclos://house-invite?token=…). */
export function isHouseInviteUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const host = (parsed.hostname || parsed.path || '').replace(/^\//, '');
    return host === 'house-invite' || (parsed.path ?? '').includes('house-invite');
  } catch {
    return url.includes('house-invite');
  }
}

export function parseHouseInviteToken(url: string): string | null {
  if (!isHouseInviteUrl(url)) return null;
  const { queryParams } = Linking.parse(url);
  const token = queryParams?.token;
  if (typeof token === 'string' && token.trim()) {
    return token.trim();
  }
  return null;
}

export async function setPendingHouseInviteToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(PENDING_KEY);
    return;
  }
  await SecureStore.setItemAsync(PENDING_KEY, token);
}

export async function takePendingHouseInviteToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY);
  if (raw) {
    await SecureStore.deleteItemAsync(PENDING_KEY);
  }
  return raw;
}

export async function peekPendingHouseInviteToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_KEY);
}
