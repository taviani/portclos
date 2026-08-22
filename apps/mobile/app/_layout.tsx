import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useSegments,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { useColorScheme } from '@/components/useColorScheme';
import { useMe } from '@/hooks/useHouses';
import { hasDisplayName } from '@/lib/displayName';
import { appEntryHref } from '@/lib/navigation';
import { reportClientEvent } from '@/lib/telemetry';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/SessionProvider';
import { Lighthouse } from '@/theme/lighthouse';

export const unstable_settings = {
  // Always enter via index so cold start / state restore cannot skip to a
  // stale path and land on the Expo "This screen doesn't exist" screen.
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

/** Reports fatal render errors to the API, then offers a retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportClientEvent({
      kind: 'error',
      name: 'ErrorBoundary',
      message: error?.message ?? 'unknown',
      meta: { stack: (error?.stack ?? '').slice(0, 1500) },
    });
  }, [error]);

  return (
    <View style={errorStyles.root}>
      <Text style={errorStyles.title}>Portclos</Text>
      <Text style={errorStyles.body}>Une erreur inattendue est survenue.</Text>
      <Pressable onPress={retry} style={errorStyles.cta} accessibilityRole="button">
        <Text style={errorStyles.ctaLabel}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: Lighthouse.foam,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Lighthouse.seaInk,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: Lighthouse.mistMuted,
    marginBottom: 24,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: Lighthouse.sea,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  ctaLabel: {
    color: Lighthouse.foam,
    fontWeight: '700',
    fontSize: 16,
  },
});

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
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
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
  const onAuthCallback = root === 'auth';
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
      {!token && !onLogin && !onIndex && !onAuthCallback ? (
        <Redirect href="/login" />
      ) : null}
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
  if (root === 'login' || root === 'auth' || onIndex) {
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
