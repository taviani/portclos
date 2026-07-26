import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
};

function apiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.apiUrl ?? 'http://localhost:8080').replace(/\/$/, '');
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${apiBaseUrl()}/health`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<{ status: string }>;
}

export async function fetchMe(accessToken: string): Promise<{ sub: string; email: string }> {
  const res = await fetch(`${apiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<{ sub: string; email: string }>;
}
