import { Stack } from 'expo-router';

export default function MaisonLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Maison' }} />
      <Stack.Screen name="presences" options={{ title: 'Présences' }} />
    </Stack>
  );
}
