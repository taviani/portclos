import { Stack } from 'expo-router';

export default function FermetureLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Fermeture' }} />
      <Stack.Screen name="modele" options={{ title: 'Modèle checklist' }} />
      <Stack.Screen name="[closingId]" options={{ title: 'Checklist' }} />
    </Stack>
  );
}
