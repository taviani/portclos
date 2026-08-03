import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';

export type HelpPhoto = {
  id: string;
  article_id: string;
  content_type: string;
  created_at: string;
};

export type HelpArticle = {
  id: string;
  house_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  photos: HelpPhoto[];
};

export async function fetchHelpArticles(
  accessToken: string,
  houseId: string,
): Promise<HelpArticle[]> {
  return getJSON(`/houses/${houseId}/help`, {
    headers: authHeaders(accessToken),
  });
}

export async function createHelpArticle(
  accessToken: string,
  houseId: string,
  input: { title: string; body?: string },
): Promise<HelpArticle> {
  return getJSON(`/houses/${houseId}/help`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchHelpArticle(
  accessToken: string,
  articleId: string,
): Promise<HelpArticle> {
  return getJSON(`/help/${articleId}`, {
    headers: authHeaders(accessToken),
  });
}

export async function updateHelpArticle(
  accessToken: string,
  articleId: string,
  input: { title: string; body: string },
): Promise<HelpArticle> {
  return getJSON(`/help/${articleId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteHelpArticle(
  accessToken: string,
  articleId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/help/${articleId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function uploadHelpPhoto(
  accessToken: string,
  articleId: string,
  uri: string,
  mimeType?: string | null,
): Promise<HelpPhoto> {
  const form = new FormData();
  const name = uri.split('/').pop() || 'photo.jpg';
  form.append('photo', {
    uri,
    name,
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
  const res = await fetch(`${apiBaseUrl()}/help/${articleId}/photos`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
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
  return res.json() as Promise<HelpPhoto>;
}

export function helpPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/help-photos/${photoId}`;
}
