import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useMe } from '@/hooks/useHouses';
import { hasDisplayName } from '@/lib/displayName';
import { resetToAppEntry } from '@/lib/navigation';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/**
 * Fallback for unmatched / stale restored routes.
 * Hard-reset the stack — a plain Link "Go to home" is not enough once
 * navigation state is corrupted (users otherwise must sign out/in).
 */
export default function NotFoundScreen() {
  const theme = useAppTheme();
  const { token, ready } = useSession();
  const me = useMe();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      resetToAppEntry({ loggedIn: false });
      return;
    }
    if (me.isLoading || (me.isFetching && !me.data)) return;
    if (me.isError) {
      resetToAppEntry({ loggedIn: true, needsDisplayName: false });
      return;
    }
    resetToAppEntry({
      loggedIn: true,
      needsDisplayName: !hasDisplayName(me.data ?? {}),
    });
  }, [ready, token, me.isLoading, me.isFetching, me.isError, me.data]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Redirection' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    </>
  );
}
