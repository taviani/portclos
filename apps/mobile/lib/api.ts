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

export type ChecklistItem = {
  id: string;
  house_id: string;
  label: string;
  optional: boolean;
  requires_photo: boolean;
  sort_order: number;
  created_at: string;
};

export type Closing = {
  id: string;
  house_id: string;
  started_by: string;
  status: 'open' | 'completed';
  started_at: string;
  completed_at?: string;
};

export type ClosingItemPhoto = {
  id: string;
  closing_item_id: string;
  content_type: string;
  created_by: string;
  created_at: string;
};

export type ClosingItem = {
  id: string;
  closing_id: string;
  label: string;
  optional: boolean;
  requires_photo: boolean;
  sort_order: number;
  status: 'todo' | 'done' | 'skipped';
  updated_at: string;
  photos: ClosingItemPhoto[];
};

export type ClosingDetail = Closing & {
  items: ClosingItem[];
};

export async function fetchChecklistItems(
  accessToken: string,
  houseId: string,
): Promise<ChecklistItem[]> {
  return getJSON(`/houses/${houseId}/closing-checklist/items`, {
    headers: authHeaders(accessToken),
  });
}

export async function createChecklistItem(
  accessToken: string,
  houseId: string,
  input: { label: string; optional?: boolean; requires_photo?: boolean },
): Promise<ChecklistItem> {
  return getJSON(`/houses/${houseId}/closing-checklist/items`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateChecklistItem(
  accessToken: string,
  itemId: string,
  input: { label: string; optional: boolean; requires_photo: boolean },
): Promise<ChecklistItem> {
  return getJSON(`/closing-checklist/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteChecklistItem(accessToken: string, itemId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/closing-checklist/items/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function fetchClosings(accessToken: string, houseId: string): Promise<Closing[]> {
  return getJSON(`/houses/${houseId}/closings`, {
    headers: authHeaders(accessToken),
  });
}

export async function startClosing(accessToken: string, houseId: string): Promise<ClosingDetail> {
  return getJSON(`/houses/${houseId}/closings`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export async function fetchClosing(
  accessToken: string,
  closingId: string,
): Promise<ClosingDetail> {
  return getJSON(`/closings/${closingId}`, {
    headers: authHeaders(accessToken),
  });
}

export async function updateClosingItemStatus(
  accessToken: string,
  closingId: string,
  itemId: string,
  status: ClosingItem['status'],
): Promise<ClosingItem> {
  return getJSON(`/closings/${closingId}/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
}

export async function completeClosing(
  accessToken: string,
  closingId: string,
): Promise<ClosingDetail> {
  return getJSON(`/closings/${closingId}/complete`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export async function uploadClosingPhoto(
  accessToken: string,
  closingId: string,
  itemId: string,
  uri: string,
  mimeType?: string | null,
): Promise<ClosingItemPhoto> {
  const form = new FormData();
  const name = uri.split('/').pop() || 'photo.jpg';
  form.append('photo', {
    uri,
    name,
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(
    `${apiBaseUrl()}/closings/${closingId}/items/${itemId}/photos`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: form,
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
  return res.json() as Promise<ClosingItemPhoto>;
}

export async function deleteClosingPhoto(accessToken: string, photoId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/closing-photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export function closingPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/closing-photos/${photoId}`;
}

export { apiBaseUrl };
