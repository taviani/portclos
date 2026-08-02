import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/paper';

export default function MaisonLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onBackground,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Maison' }} />
      <Stack.Screen name="presences" options={{ title: 'Présences' }} />
      <Stack.Screen name="fermeture" options={{ headerShown: false }} />
    </Stack>
  );
}
