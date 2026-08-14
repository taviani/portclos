import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';
import { uploadFileMultipart, uploadPhotoMultipart } from '@/lib/api/upload';

export type HelpPhoto = {
  id: string;
  article_id: string;
  content_type: string;
  created_at: string;
};

export type HelpDocument = {
  id: string;
  article_id: string;
  content_type: string;
  original_filename: string;
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
  documents: HelpDocument[];
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
  return uploadPhotoMultipart(accessToken, `/help/${articleId}/photos`, uri, mimeType);
}

export async function deleteHelpPhoto(
  accessToken: string,
  photoId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/help-photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function uploadHelpDocument(
  accessToken: string,
  articleId: string,
  uri: string,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<HelpDocument> {
  return uploadFileMultipart(
    accessToken,
    `/help/${articleId}/documents`,
    uri,
    mimeType,
    fileName,
  );
}

export async function deleteHelpDocument(
  accessToken: string,
  documentId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/help-documents/${documentId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export function helpPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/help-photos/${photoId}`;
}

export function helpDocumentUrl(documentId: string): string {
  return `${apiBaseUrl()}/help-documents/${documentId}`;
}
