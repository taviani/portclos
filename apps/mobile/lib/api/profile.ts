import { authIssuer } from '@/lib/auth';

import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';

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
