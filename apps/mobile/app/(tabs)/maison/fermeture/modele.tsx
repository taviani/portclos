import { Redirect } from 'expo-router';

/** Legacy path — checklist editing lives under Réglages. */
export default function FermetureModeleRedirect() {
  return <Redirect href="/(tabs)/maison/checklist-modele" />;
}
