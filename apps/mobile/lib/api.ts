import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
};

export type House = {
  id: string;
  name: string;
  role: string;
  created_at: string;
};

function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.apiUrl ?? 'http://localhost:8080').replace(/\/$/, '');
}

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchHealth(): Promise<{ status: string }> {
  return getJSON('/health');
}

export async function fetchMe(accessToken: string): Promise<{ sub: string; email: string }> {
  return getJSON('/me', { headers: authHeaders(accessToken) });
}

export async function fetchHouses(accessToken: string): Promise<House[]> {
  return getJSON('/houses', { headers: authHeaders(accessToken) });
}

export async function createHouse(accessToken: string, name: string): Promise<House> {
  return getJSON('/houses', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
}
