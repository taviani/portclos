import { Redirect } from 'expo-router';

/** Legacy path before Blog became a top-level tab. */
export default function MaisonBlogRedirect() {
  return <Redirect href="/(tabs)/blog" />;
}
