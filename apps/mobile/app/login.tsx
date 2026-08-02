import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { Redirect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import {
  authClientId,
  discovery,
  exchangeCodeForToken,
  isAuthConfigured,
  redirectUri,
} from '@/lib/auth';
import { useSession } from '@/providers/SessionProvider';

export default function LoginScreen() {
  const { token, ready, setSessionToken } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState('');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authClientId(),
      redirectUri: redirect || redirectUri(),
      scopes: ['openid', 'email'],
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery(),
  );

  useEffect(() => {
    setRedirect(redirectUri());
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) {
      return;
    }
    const code = response.params.code;
    if (!code) {
      setError('missing authorization code');
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const accessToken = await exchangeCodeForToken({
          code,
          codeVerifier: request.codeVerifier!,
        });
        await setSessionToken(accessToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'login failed');
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request, setSessionToken]);

  const onLogin = useCallback(async () => {
    setError(null);
    try {
      if (!isAuthConfigured()) {
        setError('Configure EXPO_PUBLIC_AUTH_ISSUER in apps/mobile/.env');
        return;
      }
      await promptAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'login failed');
    }
  }, [promptAsync]);

  const onLocalDev = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await setSessionToken('local-dev');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'local mode failed');
    } finally {
      setBusy(false);
    }
  }, [setSessionToken]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)/maison" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>
      <Pressable
        style={[styles.button, (!request || busy) && styles.disabled]}
        onPress={onLogin}
        disabled={!request || busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </Pressable>
      {__DEV__ ? (
        <Pressable style={styles.secondary} onPress={onLocalDev} disabled={busy}>
          <Text style={styles.secondaryText}>Mode local (AUTH_DISABLED)</Text>
        </Pressable>
      ) : null}
      {__DEV__ && redirect ? (
        <Text style={styles.hint}>redirect: {redirect}</Text>
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondary: {
    marginTop: 16,
  },
  secondaryText: {
    opacity: 0.7,
  },
  hint: {
    marginTop: 12,
    opacity: 0.55,
    fontSize: 12,
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
  },
});
