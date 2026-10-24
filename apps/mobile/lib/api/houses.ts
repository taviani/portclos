import { apiBaseUrl, authHeaders, getJSON, send } from '@/lib/api/http';

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

export type HouseInvite = {
  id: string;
  house_id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
};

export async function createHouseInvite(
  accessToken: string,
  houseId: string,
  email: string,
): Promise<HouseInvite> {
  return getJSON(`/houses/${houseId}/invites`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
}

export async function fetchHouseInvites(
  accessToken: string,
  houseId: string,
): Promise<HouseInvite[]> {
  return getJSON(`/houses/${houseId}/invites`, {
    headers: authHeaders(accessToken),
  });
}

export async function revokeHouseInvite(
  accessToken: string,
  houseId: string,
  inviteId: string,
): Promise<void> {
  const res = await send(`${apiBaseUrl()}/houses/${houseId}/invites/${inviteId}/revoke`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export async function acceptHouseInvite(
  accessToken: string,
  token: string,
): Promise<House> {
  return getJSON('/house-invites/accept', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
}

export async function removeHouseMember(
  accessToken: string,
  houseId: string,
  userSub: string,
): Promise<void> {
  const res = await send(
    `${apiBaseUrl()}/houses/${houseId}/members/${encodeURIComponent(userSub)}`,
    {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    },
  );
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}
