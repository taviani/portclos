import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

/**
 * Fallback for unmatched / stale restored routes.
 * Never show the Expo template "This screen doesn't exist" dead end.
 */
export default function NotFoundScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { token, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? '/(tabs)/maison' : '/login');
  }, [ready, token, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Redirection' }} />
      {ready ? (
        <Redirect href={token ? '/(tabs)/maison' : '/login'} />
      ) : (
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
      )}
    </>
  );
}
