import { authHeaders, getJSON, send } from '@/lib/api/http';

export type InventoryKind = 'stock' | 'needed';

export type InventoryItem = {
  id: string;
  house_id: string;
  label: string;
  kind: InventoryKind | string;
  priority: boolean;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function fetchInventory(
  accessToken: string,
  houseId: string,
): Promise<InventoryItem[]> {
  return getJSON(`/houses/${houseId}/inventory`, {
    headers: authHeaders(accessToken),
  });
}

export async function createInventoryItem(
  accessToken: string,
  houseId: string,
  input: { label: string; kind: InventoryKind; priority?: boolean; note?: string },
): Promise<InventoryItem> {
  return getJSON(`/houses/${houseId}/inventory`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateInventoryItem(
  accessToken: string,
  itemId: string,
  input: { label: string; kind: InventoryKind; priority?: boolean; note?: string },
): Promise<InventoryItem> {
  return getJSON(`/inventory/${itemId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteInventoryItem(
  accessToken: string,
  itemId: string,
): Promise<void> {
  await send(`/inventory/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
}
