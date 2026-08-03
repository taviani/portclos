import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy path before Blog became a top-level tab. */
export default function MaisonBlogPostRedirect() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  if (!postId) {
    return <Redirect href="/(tabs)/blog" />;
  }
  return <Redirect href={`/(tabs)/blog/${postId}`} />;
}
