import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';

import { Text, View, useThemeColor } from '@/components/Themed';
import { createHouse, fetchHouses, fetchMe, House } from '@/lib/api';
import {
  authClientId,
  discovery,
  exchangeCodeForToken,
  getAccessToken,
  isAuthConfigured,
  redirectUri,
  setAccessToken,
  setCurrentHouseId,
  getCurrentHouseId,
} from '@/lib/auth';

export default function MeScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [currentHouseId, setCurrent] = useState<string | null>(null);
  const [newHouse, setNewHouse] = useState('');
  const [loading, setLoading] = useState(true);
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

  const reload = useCallback(async (accessToken: string) => {
    const me = await fetchMe(accessToken);
    setEmail(me.email || me.sub);
    const list = await fetchHouses(accessToken);
    setHouses(list);
    const saved = await getCurrentHouseId();
    if (saved && list.some((h) => h.id === saved)) {
      setCurrent(saved);
    } else if (list.length > 0) {
      setCurrent(list[0].id);
      await setCurrentHouseId(list[0].id);
    } else {
      setCurrent(null);
    }
  }, []);

  useEffect(() => {
    setRedirect(redirectUri());
    void (async () => {
      try {
        const existing = await getAccessToken();
        if (existing) {
          setToken(existing);
          await reload(existing);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'session failed');
        await setAccessToken(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

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
        await setAccessToken(accessToken);
        setToken(accessToken);
        await reload(accessToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'login failed');
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request, reload]);

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
      // Works only when API AUTH_DISABLED=true (local / CI).
      await setAccessToken('local-dev');
      setToken('local-dev');
      await reload('local-dev');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'local mode failed');
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const onLogout = useCallback(async () => {
    await setAccessToken(null);
    await setCurrentHouseId(null);
    setToken(null);
    setEmail(null);
    setHouses([]);
    setCurrent(null);
  }, []);

  const onCreateHouse = useCallback(async () => {
    if (!token || !newHouse.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const h = await createHouse(token, newHouse.trim());
      setNewHouse('');
      await setCurrentHouseId(h.id);
      setCurrent(h.id);
      await reload(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create failed');
    } finally {
      setBusy(false);
    }
  }, [token, newHouse, reload]);

  const onSelectHouse = useCallback(async (id: string) => {
    await setCurrentHouseId(id);
    setCurrent(id);
  }, []);

  if (loading) {
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
          <Text style={styles.sub}>{email}</Text>
          <Pressable style={styles.secondary} onPress={onLogout}>
            <Text style={styles.secondaryText}>Se déconnecter</Text>
          </Pressable>

          <Text style={styles.section}>Maisons</Text>
          {houses.length === 0 ? (
            <Text style={styles.hint}>Aucune maison — crée la première.</Text>
          ) : (
            houses.map((h) => {
              const active = h.id === currentHouseId;
              return (
                <Pressable
                  key={h.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => onSelectHouse(h.id)}
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
            style={[styles.button, busy && styles.disabled]}
            onPress={onCreateHouse}
            disabled={busy || !newHouse.trim()}
          >
            <Text style={styles.buttonText}>Créer une maison</Text>
          </Pressable>
        </>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
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
