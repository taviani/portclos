import { Stack } from 'expo-router';

import { MaisonHeaderActions } from '@/components/MaisonHeaderActions';
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
        headerRight: () => <MaisonHeaderActions />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Maison' }} />
      <Stack.Screen name="infos" options={{ title: 'Infos maison' }} />
      <Stack.Screen name="fermeture" options={{ headerShown: false }} />
    </Stack>
  );
}
