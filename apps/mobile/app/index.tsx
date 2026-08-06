import { useEffect } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { resetToAppEntry } from '@/lib/navigation';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/** Root `/` — cold start entry; hard-reset into Maison or login. */
export default function Index() {
  const theme = useAppTheme();
  const { token, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    resetToAppEntry(!!token);
  }, [ready, token]);

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
