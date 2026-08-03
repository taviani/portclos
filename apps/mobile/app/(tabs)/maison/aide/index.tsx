import { Redirect } from 'expo-router';

/** Legacy path before Aide became a top-level tab. */
export default function MaisonAideRedirect() {
  return <Redirect href="/(tabs)/aide" />;
}
