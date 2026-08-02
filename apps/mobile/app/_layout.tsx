import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import 'react-native-reanimated';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { useColorScheme } from '@/components/useColorScheme';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/SessionProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  return (
    <AppProviders>
      <SplashGate fontsLoaded={loaded}>{loaded ? <RootLayoutNav /> : null}</SplashGate>
    </AppProviders>
  );
}

function SplashGate({
  fontsLoaded,
  children,
}: {
  fontsLoaded: boolean;
  children: ReactNode;
}) {
  const { ready: sessionReady } = useSession();
  return (
    <AnimatedSplash ready={fontsLoaded && sessionReady}>{children}</AnimatedSplash>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { token, ready } = useSession();
  const segments = useSegments();

  if (!ready) {
    return null;
  }

  const onLogin = segments[0] === 'login';

  return (
    <>
      {!token && !onLogin ? <Redirect href="/login" /> : null}
      {token && onLogin ? <Redirect href="/(tabs)/maison" /> : null}
      {children}
    </>
  );
}
