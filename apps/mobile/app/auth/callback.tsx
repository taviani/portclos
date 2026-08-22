import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { useMe } from '@/hooks/useHouses';
import { completeAuthorization, parseAuthCallbackParams } from '@/lib/authCallback';
import { hasDisplayName } from '@/lib/displayName';
import { appEntryHref } from '@/lib/navigation';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/**
 * OAuth redirect target (`portclos://auth/callback`).
 * Android Chrome often cannot auto-follow the 302, so the user taps the
 * page link (historically the word "Found") and lands here.
 */
export default function AuthCallbackScreen() {
  const theme = useAppTheme();
  const { token, ready, setSessionTokens } = useSession();
  const params = useLocalSearchParams<{ code?: string | string[]; state?: string | string[] }>();
  const me = useMe();
  const [error, setError] = useState<string | null>(null);

  const code = params.code;
  const state = params.state;

  useEffect(() => {
    if (!ready || token) {
      return;
    }
    const parsed = parseAuthCallbackParams({ code, state });
    if (!parsed) {
      setError('missing authorization code');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const bundle = await completeAuthorization(parsed);
        if (cancelled) {
          return;
        }
        if (!bundle) {
          setError('login session expired — retry');
          return;
        }
        await setSessionTokens(bundle);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'login failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, code, state, setSessionTokens]);

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
    return <Redirect href={appEntryHref({ loggedIn: true, needsDisplayName })} />;
  }

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
