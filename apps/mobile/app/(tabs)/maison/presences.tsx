import { Redirect } from 'expo-router';

/** Legacy path before Présences became a top-level tab. */
export default function MaisonPresencesRedirect() {
  return <Redirect href="/(tabs)/presences" />;
}
