import { Stack, router } from 'expo-router';
import { Appbar } from 'react-native-paper';

import { MaisonHeaderActions } from '@/components/MaisonHeaderActions';
import { useAppTheme } from '@/theme/paper';

function FermetureBackButton({ fallback }: { fallback: '/(tabs)/maison' | '/(tabs)/maison/fermeture' }) {
  return (
    <Appbar.BackAction
      accessibilityLabel="Retour"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(fallback);
      }}
    />
  );
}

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
        headerRight: () => <MaisonHeaderActions />,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Fermeture',
          headerLeft: () => <FermetureBackButton fallback="/(tabs)/maison" />,
        }}
      />
      <Stack.Screen name="modele" options={{ title: 'Modèle checklist' }} />
      <Stack.Screen
        name="[closingId]"
        options={{
          title: 'Checklist',
          headerLeft: () => <FermetureBackButton fallback="/(tabs)/maison/fermeture" />,
        }}
      />
    </Stack>
  );
}
