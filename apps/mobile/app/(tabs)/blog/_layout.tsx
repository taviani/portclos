import { Stack } from 'expo-router';

import { MaisonHeaderActions } from '@/components/MaisonHeaderActions';
import { useAppTheme } from '@/theme/paper';

export default function BlogLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Blog' }} />
      <Stack.Screen name="[postId]" options={{ title: 'Publication' }} />
    </Stack>
  );
}
