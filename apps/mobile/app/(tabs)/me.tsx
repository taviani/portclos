import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useQueryClient } from '@tanstack/react-query';

import { Text, View, useThemeColor } from '@/components/Themed';
import {
  useCreateHouse,
  useCurrentHouseId,
  useHouses,
  useMe,
  useSelectHouse,
} from '@/hooks/useHouses';
import {
  authClientId,
  discovery,
  exchangeCodeForToken,
  isAuthConfigured,
  redirectUri,
  setCurrentHouseId,
} from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export default function MeScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');

  const { token, ready, setSessionToken, signOut } = useSession();
  const qc = useQueryClient();
  const me = useMe();
  const houses = useHouses();
  const currentHouseId = useCurrentHouseId();
  const createHouse = useCreateHouse();
  const selectHouse = useSelectHouse();

  const [newHouse, setNewHouse] = useState('');
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
    if (!token || !houses.data?.length || currentHouseId.data) {
      return;
    }
    const first = houses.data[0];
    void (async () => {
      await setCurrentHouseId(first.id);
      await qc.invalidateQueries({ queryKey: queryKeys.currentHouseId });
    })();
  }, [token, houses.data, currentHouseId.data, qc]);

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

  const onCreateHouse = useCallback(async () => {
    if (!newHouse.trim()) return;
    setError(null);
    try {
      await createHouse.mutateAsync(newHouse.trim());
      setNewHouse('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create failed');
    }
  }, [newHouse, createHouse]);

  const onSelectHouse = useCallback(
    async (id: string) => {
      try {
        await selectHouse.mutateAsync(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'select failed');
      }
    },
    [selectHouse],
  );

  const email = me.data?.email || me.data?.sub || null;
  const mutating = busy || createHouse.isPending || selectHouse.isPending;
  const queryError =
    (me.error instanceof Error && me.error.message) ||
    (houses.error instanceof Error && houses.error.message) ||
    null;

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compte</Text>
      {!token ? (
        <>
          <Text style={styles.sub}>Connexion OIDC (invite-only + PKCE).</Text>
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
          {redirect ? <Text style={styles.hint}>redirect: {redirect}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.sub}>{email ?? '…'}</Text>
          <Pressable style={styles.secondary} onPress={() => void signOut()}>
            <Text style={styles.secondaryText}>Se déconnecter</Text>
          </Pressable>

          <Text style={styles.section}>Maisons</Text>
          {houses.isLoading ? (
            <ActivityIndicator />
          ) : (houses.data?.length ?? 0) === 0 ? (
            <Text style={styles.hint}>Aucune maison — crée la première.</Text>
          ) : (
            houses.data!.map((h) => {
              const active = h.id === currentHouseId.data;
              return (
                <Pressable
                  key={h.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => void onSelectHouse(h.id)}
                >
                  <Text style={active ? styles.rowTextActive : undefined}>
                    {h.name} ({h.role})
                  </Text>
                </Pressable>
              );
            })
          )}

          <TextInput
            style={[
              styles.input,
              {
                color: inputColor,
                borderColor: inputBorder,
                backgroundColor: inputBg,
              },
            ]}
            placeholder="Nom de la maison"
            placeholderTextColor={placeholderColor}
            value={newHouse}
            onChangeText={setNewHouse}
            keyboardAppearance="default"
          />
          <Pressable
            style={[styles.button, mutating && styles.disabled]}
            onPress={() => void onCreateHouse()}
            disabled={mutating || !newHouse.trim()}
          >
            <Text style={styles.buttonText}>Créer une maison</Text>
          </Pressable>
        </>
      )}
      {error || queryError ? <Text style={styles.err}>{error || queryError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  sub: {
    marginTop: 12,
    opacity: 0.7,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    marginTop: 8,
    opacity: 0.55,
    fontSize: 12,
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
    marginTop: 12,
  },
  secondaryText: {
    opacity: 0.7,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowActive: {
    backgroundColor: '#1a1612',
  },
  rowTextActive: {
    color: '#fff',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
  },
});
