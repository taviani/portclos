import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/paper';

export default function FermetureLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Fermeture' }} />
      <Stack.Screen name="modele" options={{ title: 'Modèle checklist' }} />
      <Stack.Screen name="[closingId]" options={{ title: 'Checklist' }} />
    </Stack>
  );
}
