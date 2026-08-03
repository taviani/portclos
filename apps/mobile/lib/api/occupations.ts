import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';

export type Occupation = {
  id: string;
  house_id: string;
  user_sub: string;
  start_date: string;
  end_date: string;
  note: string;
  created_at: string;
};

export async function fetchOccupations(
  accessToken: string,
  houseId: string,
  from: string,
  to: string,
): Promise<Occupation[]> {
  const q = new URLSearchParams({ from, to });
  return getJSON(`/houses/${houseId}/occupations?${q}`, {
    headers: authHeaders(accessToken),
  });
}

export async function createOccupation(
  accessToken: string,
  houseId: string,
  input: { start_date: string; end_date: string; note?: string },
): Promise<Occupation> {
  return getJSON(`/houses/${houseId}/occupations`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteOccupation(accessToken: string, occupationId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/occupations/${occupationId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
