import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';
import { uploadPhotoMultipart } from '@/lib/api/upload';

export type ChecklistItemPhoto = {
  id: string;
  checklist_item_id: string;
  content_type: string;
  created_by: string;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  house_id: string;
  label: string;
  optional: boolean;
  sort_order: number;
  created_at: string;
  photos: ChecklistItemPhoto[];
};

export type Closing = {
  id: string;
  house_id: string;
  started_by: string;
  status: 'open' | 'completed';
  started_at: string;
  completed_at?: string;
};

export type ClosingItem = {
  id: string;
  closing_id: string;
  label: string;
  optional: boolean;
  sort_order: number;
  status: 'todo' | 'done' | 'skipped';
  updated_at: string;
  /** Indication photos from the template item. */
  photos: ChecklistItemPhoto[];
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
  input: { label: string; optional?: boolean },
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
  input: { label: string; optional: boolean },
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

export async function uploadChecklistPhoto(
  accessToken: string,
  itemId: string,
  uri: string,
  mimeType?: string | null,
): Promise<ChecklistItemPhoto> {
  return uploadPhotoMultipart(
    accessToken,
    `/closing-checklist/items/${itemId}/photos`,
    uri,
    mimeType,
  );
}

export async function deleteChecklistPhoto(accessToken: string, photoId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/closing-photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export function checklistPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/closing-photos/${photoId}`;
}
