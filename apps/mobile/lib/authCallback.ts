import * as SecureStore from 'expo-secure-store';

import { exchangeCodeForToken, type TokenBundle } from '@/lib/auth';

const PKCE_VERIFIER_KEY = 'portclos.pkce_verifier';
const PKCE_STATE_KEY = 'portclos.pkce_state';

export type AuthCallbackParams = {
  code: string;
  state: string;
};

type LoginChallenge = {
  codeVerifier: string;
  state: string;
};

let completing: Promise<TokenBundle | null> | null = null;
let lastBundle: TokenBundle | null = null;

export function parseAuthCallbackParams(params: {
  code?: string | string[];
  state?: string | string[];
}): AuthCallbackParams | null {
  const code = firstParam(params.code)?.trim() ?? '';
  if (!code) {
    return null;
  }
  return { code, state: firstParam(params.state)?.trim() ?? '' };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Store PKCE + state so the custom-scheme bounce can finish login. */
export async function persistLoginChallenge(challenge: LoginChallenge): Promise<void> {
  lastBundle = null;
  await SecureStore.setItemAsync(PKCE_VERIFIER_KEY, challenge.codeVerifier);
  await SecureStore.setItemAsync(PKCE_STATE_KEY, challenge.state);
}

async function takeLoginChallenge(): Promise<LoginChallenge | null> {
  const codeVerifier = await SecureStore.getItemAsync(PKCE_VERIFIER_KEY);
  const state = (await SecureStore.getItemAsync(PKCE_STATE_KEY)) ?? '';
  if (!codeVerifier) {
    return null;
  }
  await SecureStore.deleteItemAsync(PKCE_VERIFIER_KEY);
  await SecureStore.deleteItemAsync(PKCE_STATE_KEY);
  return { codeVerifier, state };
}

/** Exchange the auth code. Single-flight so login + callback cannot consume it twice. */
export async function completeAuthorization(
  params: AuthCallbackParams,
): Promise<TokenBundle | null> {
  if (completing) {
    return completing;
  }
  if (lastBundle) {
    return lastBundle;
  }
  completing = (async () => {
    try {
      const challenge = await takeLoginChallenge();
      if (!challenge) {
        return lastBundle;
      }
      if (challenge.state && params.state && challenge.state !== params.state) {
        throw new Error('invalid login state');
      }
      const bundle = await exchangeCodeForToken({
        code: params.code,
        codeVerifier: challenge.codeVerifier,
      });
      lastBundle = bundle;
      return bundle;
    } finally {
      completing = null;
    }
  })();
  return completing;
}
