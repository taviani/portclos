import { authHeaders, getJSON } from '@/lib/api/http';

export type House = {
  id: string;
  name: string;
  role: string;
  address: string;
  single_beds: number;
  double_beds: number;
  bed_capacity: number;
  created_at: string;
};

export type HouseMember = {
  user_sub: string;
  display_name: string;
  email: string;
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

export async function updateHouse(
  accessToken: string,
  houseId: string,
  patch: {
    bed_capacity?: number;
    single_beds?: number;
    double_beds?: number;
    address?: string;
  },
): Promise<House> {
  return getJSON(`/houses/${houseId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
}

export async function updateHouseBedCapacity(
  accessToken: string,
  houseId: string,
  bedCapacity: number,
): Promise<House> {
  return updateHouse(accessToken, houseId, { bed_capacity: bedCapacity });
}

export async function fetchHouseMembers(
  accessToken: string,
  houseId: string,
): Promise<HouseMember[]> {
  return getJSON(`/houses/${houseId}/members`, {
    headers: authHeaders(accessToken),
  });
}
