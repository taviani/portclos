/**
 * Parse the Portclos OAuth redirect (`portclos://auth/callback`).
 * Kept free of React Native imports so it can be unit-tested with Node.
 */

export type AuthCallbackParams = {
  code: string;
  state: string;
};

/** True when this URL is the OAuth redirect back into Portclos. */
export function isAuthCallbackUrl(url: string): boolean {
  return parseAuthCallbackUrl(url) !== null;
}

/**
 * Parse `portclos://auth/callback?code=&state=` (and the triple-slash variant).
 * Chrome on Android often lands here via a 302 body whose link text is "Found".
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (scheme !== 'portclos') {
    return null;
  }
  const combined = `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  if (combined !== 'auth/callback' && combined !== '/auth/callback') {
    return null;
  }
  const code = parsed.searchParams.get('code')?.trim() ?? '';
  if (!code) {
    return null;
  }
  return {
    code,
    state: parsed.searchParams.get('state')?.trim() ?? '',
  };
}

export function parseAuthCallbackParams(params: {
  code?: string | string[];
  state?: string | string[];
}): AuthCallbackParams | null {
  const code = firstParam(params.code)?.trim() ?? '';
  if (!code) {
    return null;
  }
  return {
    code,
    state: firstParam(params.state)?.trim() ?? '',
  };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
