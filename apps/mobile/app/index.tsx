import { useEffect } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useMe } from '@/hooks/useHouses';
import { hasDisplayName } from '@/lib/displayName';
import { resetToAppEntry } from '@/lib/navigation';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/** Root `/` — cold start entry; hard-reset into the right signed-in surface. */
export default function Index() {
  const theme = useAppTheme();
  const { token, ready } = useSession();
  const me = useMe();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      resetToAppEntry({ loggedIn: false });
      return;
    }
    // Wait for profile so we never flash Maison before the display-name gate.
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
  );
}
