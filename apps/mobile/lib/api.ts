import Constants from 'expo-constants';

import { authIssuer } from '@/lib/auth';

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

export type MeProfile = {
  sub: string;
  email: string;
  display_name: string;
  has_avatar: boolean;
  updated_at?: string;
};

export async function fetchMe(accessToken: string): Promise<MeProfile> {
  return getJSON('/me', { headers: authHeaders(accessToken) });
}

export async function updateDisplayName(
  accessToken: string,
  displayName: string,
): Promise<MeProfile> {
  return getJSON('/me', {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function uploadAvatar(
  accessToken: string,
  uri: string,
  mimeType?: string | null,
): Promise<MeProfile> {
  const form = new FormData();
  const name = uri.split('/').pop() || 'avatar.jpg';
  form.append('photo', {
    uri,
    name,
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
  const res = await fetch(`${apiBaseUrl()}/me/avatar`, {
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
  return res.json() as Promise<MeProfile>;
}

export async function deleteAvatar(accessToken: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/me/avatar`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export function avatarUrl(userSub: string): string {
  return `${apiBaseUrl()}/avatars/${encodeURIComponent(userSub)}`;
}

export async function changePassword(
  accessToken: string,
  input: {
    current_password: string;
    new_password: string;
    new_password_confirm: string;
  },
): Promise<void> {
  const res = await fetch(`${authIssuer()}/account/password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: string;
        error_description?: string;
        field?: string;
      };
      detail = body.error_description || body.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export type BlogPhoto = {
  id: string;
  post_id: string;
  content_type: string;
  created_at: string;
};

export type BlogReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type BlogComment = {
  id: string;
  post_id: string;
  author_sub: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type BlogPost = {
  id: string;
  house_id: string;
  author_sub: string;
  author_name: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  photos: BlogPhoto[];
  reactions: BlogReaction[];
  comments?: BlogComment[];
};

export async function fetchBlogPosts(
  accessToken: string,
  houseId: string,
): Promise<BlogPost[]> {
  return getJSON(`/houses/${houseId}/posts`, {
    headers: authHeaders(accessToken),
  });
}

export async function createBlogPost(
  accessToken: string,
  houseId: string,
  input: { title: string; body?: string },
): Promise<BlogPost> {
  return getJSON(`/houses/${houseId}/posts`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchBlogPost(
  accessToken: string,
  postId: string,
): Promise<BlogPost> {
  return getJSON(`/posts/${postId}`, {
    headers: authHeaders(accessToken),
  });
}

export async function deleteBlogPost(accessToken: string, postId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function uploadBlogPhoto(
  accessToken: string,
  postId: string,
  uri: string,
  mimeType?: string | null,
): Promise<BlogPhoto> {
  const form = new FormData();
  const name = uri.split('/').pop() || 'photo.jpg';
  form.append('photo', {
    uri,
    name,
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
  const res = await fetch(`${apiBaseUrl()}/posts/${postId}/photos`, {
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
  return res.json() as Promise<BlogPhoto>;
}

export function blogPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/blog-photos/${photoId}`;
}

export async function addBlogComment(
  accessToken: string,
  postId: string,
  body: string,
): Promise<BlogComment> {
  return getJSON(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
}

export async function deleteBlogComment(
  accessToken: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function setBlogReaction(
  accessToken: string,
  postId: string,
  emoji: string,
): Promise<BlogReaction[]> {
  return getJSON(`/posts/${postId}/reactions`, {
    method: 'PUT',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emoji }),
  });
}

export async function clearBlogReaction(
  accessToken: string,
  postId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/posts/${postId}/reactions`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

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
  const form = new FormData();
  const name = uri.split('/').pop() || 'photo.jpg';
  form.append('photo', {
    uri,
    name,
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${apiBaseUrl()}/closing-checklist/items/${itemId}/photos`, {
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
  return res.json() as Promise<ChecklistItemPhoto>;
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

export { apiBaseUrl };
