import { authHeaders, getJSON } from '@/lib/api/http';

export type House = {
  id: string;
  name: string;
  role: string;
  created_at: string;
};

export type HouseMember = {
  user_sub: string;
  display_name: string;
  role: string;
  has_avatar: boolean;
};

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

export async function fetchHouseMembers(
  accessToken: string,
  houseId: string,
): Promise<HouseMember[]> {
  return getJSON(`/houses/${houseId}/members`, {
    headers: authHeaders(accessToken),
  });
}
