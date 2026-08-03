import { Redirect, Stack } from 'expo-router';

/** Fallback for unmatched routes — send users home instead of a dead end. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Redirection' }} />
      <Redirect href="/(tabs)/maison" />
    </>
  );
}
