import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/** Root `/` — required so cold start does not land on +not-found. */
export default function Index() {
  const theme = useAppTheme();
  const { token, ready } = useSession();

  if (!ready) {
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

  if (!token) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/maison" />;
}
