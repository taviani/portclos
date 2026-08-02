import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import {
  authClientId,
  discovery,
  exchangeCodeForToken,
  isAuthConfigured,
  redirectUri,
} from '@/lib/auth';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export default function LoginScreen() {
  const theme = useAppTheme();
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
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)/maison" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text
        variant="displaySmall"
        style={{ color: theme.colors.primary, fontWeight: '800', letterSpacing: -1 }}
      >
        Portclos
      </Text>
      <Text
        variant="headlineSmall"
        style={{ color: theme.colors.onBackground, fontWeight: '700', marginTop: 8 }}
      >
        Connexion
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 10, marginBottom: 28, lineHeight: 24 }}
      >
        Accède à ta maison partagée.
      </Text>
      <Button
        mode="contained"
        icon="login"
        onPress={onLogin}
        disabled={!request || busy}
        loading={busy}
        contentStyle={{ minHeight: 52 }}
        style={{ borderRadius: 16 }}
      >
        Se connecter
      </Button>
      {__DEV__ ? (
        <Button mode="text" onPress={onLocalDev} disabled={busy} style={{ marginTop: 12 }}>
          Mode local (AUTH_DISABLED)
        </Button>
      ) : null}
      {__DEV__ && redirect ? (
        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 16 }}>
          redirect: {redirect}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
