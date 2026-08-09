import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { LighthouseMark } from '@/components/LighthouseMark';
import { useMe } from '@/hooks/useHouses';
import {
  AUTH_SCOPES,
  authClientId,
  discovery,
  exchangeCodeForToken,
  isAuthConfigured,
  redirectUri,
} from '@/lib/auth';
import { hasDisplayName } from '@/lib/displayName';
import { appEntryHref } from '@/lib/navigation';
import { useSession } from '@/providers/SessionProvider';
import { Lighthouse } from '@/theme/lighthouse';
import { useAppTheme } from '@/theme/paper';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { token, ready, setSessionTokens, setSessionToken } = useSession();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState('');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authClientId(),
      redirectUri: redirect || redirectUri(),
      scopes: [...AUTH_SCOPES],
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
        const bundle = await exchangeCodeForToken({
          code,
          codeVerifier: request.codeVerifier!,
        });
        await setSessionTokens(bundle);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'login failed');
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request, setSessionTokens]);

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
    if (me.isLoading || (me.isFetching && !me.data)) {
      return (
        <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator animating color={theme.colors.primary} />
        </View>
      );
    }
    const needsDisplayName =
      me.isSuccess && me.data ? !hasDisplayName(me.data) : false;
    return (
      <Redirect href={appEntryHref({ loggedIn: true, needsDisplayName })} />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.markWrap}>
        <LighthouseMark width={168} height={220} />
      </View>
      <Text
        variant="displaySmall"
        style={{ color: theme.colors.primary, fontWeight: '800', letterSpacing: -1 }}
      >
        Portclos
      </Text>
      <Text
        variant="titleMedium"
        style={{ color: Lighthouse.beaconDeep, fontWeight: '600', marginTop: 4 }}
      >
        gestionnaire de maison
      </Text>
      <Text
        variant="bodyLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          marginTop: 14,
          marginBottom: 28,
          lineHeight: 24,
        }}
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
        buttonColor={theme.colors.primary}
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
  markWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
