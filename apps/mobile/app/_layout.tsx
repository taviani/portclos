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
import { useMe } from '@/hooks/useHouses';
import { hasDisplayName } from '@/lib/displayName';
import { appEntryHref } from '@/lib/navigation';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/SessionProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Always enter via index so cold start / state restore cannot skip to a
  // stale path and land on the Expo "This screen doesn't exist" screen.
  initialRouteName: 'index',
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
  const { ready: sessionReady, token } = useSession();
  const me = useMe();
  // Hold splash until profile is known so cold start never paints Maison
  // then immediately bounces to display-name.
  const profileReady = !token || me.isSuccess || me.isError;
  return (
    <AnimatedSplash ready={fontsLoaded && sessionReady && profileReady}>
      {children}
    </AnimatedSplash>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <DisplayNameGate>
          <RootStack />
        </DisplayNameGate>
      </AuthGate>
    </ThemeProvider>
  );
}

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="display-name" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
      <Stack.Screen
        name="compte"
        options={{
          title: 'Compte',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { token, ready } = useSession();
  const segments = useSegments();
  const me = useMe();

  if (!ready) {
    return null;
  }

  const root = segments[0];
  const onLogin = root === 'login';
  // Root `/` is handled by app/index.tsx; do not fight that redirect here.
  const onIndex = root === undefined || root === 'index';

  let loginRedirect: ReactNode = null;
  if (token && onLogin) {
    const profilePending = me.isLoading || (me.isFetching && !me.data);
    if (!profilePending) {
      const needsDisplayName = me.isSuccess && me.data ? !hasDisplayName(me.data) : false;
      loginRedirect = (
        <Redirect href={appEntryHref({ loggedIn: true, needsDisplayName })} />
      );
    }
  }

  return (
    <>
      {!token && !onLogin && !onIndex ? <Redirect href="/login" /> : null}
      {loginRedirect}
      {children}
    </>
  );
}

/** Signed-in users without a display name must pick one before the house UI. */
function DisplayNameGate({ children }: { children: ReactNode }) {
  const { token, ready } = useSession();
  const segments = useSegments();
  const me = useMe();

  if (!ready || !token) {
    return <>{children}</>;
  }

  const root = segments[0];
  const onIndex = root === undefined || root === 'index';
  const onDisplayName = root === 'display-name';
  // Let login / cold-start index finish their own redirects first.
  if (root === 'login' || onIndex) {
    return <>{children}</>;
  }

  if (me.isLoading || (me.isFetching && !me.data)) {
    return null;
  }

  // Profile fetch failed: do not soft-lock the whole app on this screen.
  if (me.isError) {
    return <>{children}</>;
  }

  const named = me.data ? hasDisplayName(me.data) : false;

  return (
    <>
      {!named && !onDisplayName ? <Redirect href="/display-name" /> : null}
      {named && onDisplayName ? <Redirect href="/(tabs)/maison" /> : null}
      {children}
    </>
  );
}
