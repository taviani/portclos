import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy path before Aide became a top-level tab. */
export default function MaisonAideArticleRedirect() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  if (!articleId) {
    return <Redirect href="/(tabs)/aide" />;
  }
  return <Redirect href={`/(tabs)/aide/${articleId}`} />;
}
