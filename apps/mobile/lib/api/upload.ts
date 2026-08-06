import { File, UploadType } from 'expo-file-system';

import { apiBaseUrl, authHeaders, notifyUnauthorized } from '@/lib/api/http';

/**
 * Multipart photo upload via expo-file-system File.upload.
 * Avoids RN FormData `{ uri, name, type }` which throws
 * "Unsupported FormDataPart implementation" under Expo's fetch.
 */
export async function uploadPhotoMultipart<T>(
  accessToken: string,
  path: string,
  uri: string,
  mimeType?: string | null,
): Promise<T> {
  const file = new File(uri);
  const result = await file.upload(`${apiBaseUrl()}${path}`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'photo',
    mimeType: mimeType || 'image/jpeg',
    headers: authHeaders(accessToken) as Record<string, string>,
  });
  if (result.status < 200 || result.status >= 300) {
    if (result.status === 401) {
      notifyUnauthorized();
    }
    let detail = `HTTP ${result.status}`;
    try {
      const body = JSON.parse(result.body) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return JSON.parse(result.body) as T;
}
