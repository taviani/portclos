import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { exchangeCodeForToken, takePkceVerifier } from '@/lib/auth';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/** Deep-link target for `portclos://auth/callback`. Session gate handles the rest. */
export default function AuthCallbackScreen() {
  const theme = useAppTheme();
  const { token, ready, setSessionTokens } = useSession();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const [error, setError] = useState<string | null>(null);
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  useEffect(() => {
    if (!ready || token) {
      return;
    }
    if (!code) {
      setError('missing authorization code');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const codeVerifier = await takePkceVerifier();
        if (!codeVerifier) {
          throw new Error('login session expired — retry');
        }
        const bundle = await exchangeCodeForToken({ code, codeVerifier });
        if (!cancelled) {
          await setSessionTokens(bundle);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'login failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, code, setSessionTokens]);

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      {error ? (
        <>
          <Text style={{ color: theme.colors.error, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </Text>
          <Button mode="contained" onPress={() => router.replace('/login')}>
            Retour
          </Button>
        </>
      ) : (
        <ActivityIndicator animating color={theme.colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
});
