import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';

import { exchangeCodeForToken, type TokenBundle } from '@/lib/auth';
import {
  parseAuthCallbackUrl,
  type AuthCallbackParams,
} from '@/lib/authCallbackUrl';

export {
  isAuthCallbackUrl,
  parseAuthCallbackParams,
  parseAuthCallbackUrl,
  type AuthCallbackParams,
} from '@/lib/authCallbackUrl';

const PKCE_VERIFIER_KEY = 'portclos.pkce_verifier';
const PKCE_STATE_KEY = 'portclos.pkce_state';

type LoginChallenge = {
  codeVerifier: string;
  state: string;
};

let completing: Promise<TokenBundle | null> | null = null;
let lastBundle: TokenBundle | null = null;

/** Store PKCE + state so Android can finish login after Chrome Custom Tabs bounce. */
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

/**
 * Exchange an authorization code. Single-flight so login.tsx, the callback
 * route, and a Linking listener cannot consume the code twice.
 * Returns null when no PKCE challenge is stored (already completed / stale).
 */
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

/** Subscribe to custom-scheme returns while an in-app browser is still open. */
export function subscribeAuthCallback(
  onParams: (params: AuthCallbackParams) => void,
): { remove: () => void } {
  const sub = Linking.addEventListener('url', ({ url }) => {
    const parsed = parseAuthCallbackUrl(url);
    if (parsed) {
      onParams(parsed);
    }
  });
  return sub;
}
