import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/paper';

export default function AideLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Aide' }} />
      <Stack.Screen name="[articleId]" options={{ title: 'Fiche' }} />
    </Stack>
  );
}
