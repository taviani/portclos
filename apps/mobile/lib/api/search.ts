import { authHeaders, getJSON } from '@/lib/api/http';

export type SearchHit = {
  type: 'help' | 'blog' | 'closing' | 'occupation' | string;
  id: string;
  title: string;
  snippet: string;
  rank: number;
};

export async function searchHouse(
  accessToken: string,
  houseId: string,
  q: string,
): Promise<SearchHit[]> {
  const params = new URLSearchParams({ q });
  return getJSON(`/houses/${houseId}/search?${params}`, {
    headers: authHeaders(accessToken),
  });
}
