import { File, UploadType } from 'expo-file-system';

import {
  apiBaseUrl,
  authHeaders,
  notifyUnauthorized,
  throwNetworkOrOriginal,
  tryRefreshAccessToken,
} from '@/lib/api/http';

type MultipartOpts = {
  fieldName?: string;
  mimeType?: string | null;
  parameters?: Record<string, string>;
};

/**
 * Multipart upload via expo-file-system File.upload.
 * Avoids RN FormData `{ uri, name, type }` which throws
 * "Unsupported FormDataPart implementation" under Expo's fetch.
 */
export async function uploadMultipart<T>(
  accessToken: string,
  path: string,
  uri: string,
  opts?: MultipartOpts,
): Promise<T> {
  const fieldName = opts?.fieldName || 'photo';
  const mimeType = opts?.mimeType || 'application/octet-stream';

  const uploadOnce = async (token: string) => {
    const file = new File(uri);
    try {
      return await file.upload(`${apiBaseUrl()}${path}`, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName,
        mimeType,
        headers: authHeaders(token) as Record<string, string>,
        ...(opts?.parameters ? { parameters: opts.parameters } : {}),
      });
    } catch (err) {
      throwNetworkOrOriginal(err);
    }
  };

  let result = await uploadOnce(accessToken);
  if (result.status === 401) {
    const next = await tryRefreshAccessToken();
    if (next) {
      result = await uploadOnce(next);
    }
  }

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

export async function uploadPhotoMultipart<T>(
  accessToken: string,
  path: string,
  uri: string,
  mimeType?: string | null,
): Promise<T> {
  return uploadMultipart(accessToken, path, uri, {
    fieldName: 'photo',
    mimeType: mimeType || 'image/jpeg',
  });
}

export async function uploadFileMultipart<T>(
  accessToken: string,
  path: string,
  uri: string,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<T> {
  return uploadMultipart(accessToken, path, uri, {
    fieldName: 'file',
    mimeType: mimeType || 'application/octet-stream',
    ...(fileName
      ? { parameters: { original_filename: fileName } }
      : {}),
  });
}
