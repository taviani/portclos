import { authHeaders, getJSON, send } from '@/lib/api/http';

export type ChantierStatus = 'planned' | 'in_progress' | 'done';

export type Chantier = {
  id: string;
  house_id: string;
  title: string;
  description: string;
  status: ChantierStatus | string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const CHANTIER_STATUS_LABELS: Record<string, string> = {
  planned: 'Prévu',
  in_progress: 'En cours',
  done: 'Terminé',
};

export async function fetchChantiers(
  accessToken: string,
  houseId: string,
): Promise<Chantier[]> {
  return getJSON(`/houses/${houseId}/chantiers`, {
    headers: authHeaders(accessToken),
  });
}

export async function createChantier(
  accessToken: string,
  houseId: string,
  input: { title: string; description?: string; status?: ChantierStatus },
): Promise<Chantier> {
  return getJSON(`/houses/${houseId}/chantiers`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateChantier(
  accessToken: string,
  chantierId: string,
  input: { title: string; description?: string; status: ChantierStatus },
): Promise<Chantier> {
  return getJSON(`/chantiers/${chantierId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteChantier(
  accessToken: string,
  chantierId: string,
): Promise<void> {
  await send(`/chantiers/${chantierId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
}
