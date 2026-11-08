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
      <Stack.Screen name="infos" options={{ title: 'Réglages' }} />
      <Stack.Screen name="checklist-modele" options={{ title: 'Checklist de fermeture' }} />
      <Stack.Screen name="fermeture" options={{ headerShown: false }} />
      <Stack.Screen name="inventaire" options={{ title: 'Inventaire' }} />
      <Stack.Screen name="chantier" options={{ title: 'Chantier' }} />
    </Stack>
  );
}
