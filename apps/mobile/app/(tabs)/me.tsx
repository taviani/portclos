import { Redirect } from 'expo-router';

/** Legacy tab route after Compte moved to the root stack. */
export default function MeRedirect() {
  return <Redirect href="/compte" />;
}
