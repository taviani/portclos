import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Href, router } from 'expo-router';
import {
  ActivityIndicator,
  Button,
  FAB,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import { useCreateHelpArticle, useHelpArticles } from '@/hooks/useHelp';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useAppTheme } from '@/theme/paper';

export default function AideListScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const articles = useHelpArticles(house?.id);
  const createArticle = useCreateHelpArticle(house?.id);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) return;
    setError(null);
    try {
      const a = await createArticle.mutateAsync({
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setComposing(false);
      router.push(`/(tabs)/maison/aide/${a.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'création impossible');
    }
  };

  if (isLoading || articles.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={[styles.pad, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          Choisis une maison dans Compte.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16, lineHeight: 24 }}
        >
          Mode d’emploi de la maison : jardin, wifi, pompe, et tout ce qu’il faut savoir.
        </Text>

        {composing ? (
          <View style={{ marginBottom: 20 }}>
            <TextInput
              mode="outlined"
              label="Titre"
              value={title}
              onChangeText={setTitle}
              style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
            />
            <TextInput
              mode="outlined"
              label="Contenu"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={5}
              style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="text" onPress={() => setComposing(false)}>
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={() => void create()}
                loading={createArticle.isPending}
                disabled={!title.trim() || createArticle.isPending}
                style={{ borderRadius: 12 }}
              >
                Créer
              </Button>
            </View>
          </View>
        ) : null}

        {(articles.data ?? []).map((a) => (
          <List.Item
            key={a.id}
            title={a.title}
            description={a.body ? a.body.slice(0, 100) : 'Sans texte'}
            descriptionNumberOfLines={2}
            onPress={() => router.push(`/(tabs)/maison/aide/${a.id}` as Href)}
            left={(props) => (
              <List.Icon {...props} icon="help-circle-outline" color={theme.colors.primary} />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            style={{
              backgroundColor: theme.colors.elevation.level1,
              borderRadius: theme.roundness,
              marginBottom: 10,
            }}
            titleStyle={{ fontWeight: '700', color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
          />
        ))}

        {error ? (
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>{error}</Text>
        ) : null}
        {articles.error instanceof Error ? (
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>
            {articles.error.message}
          </Text>
        ) : null}
      </ScrollView>

      {!composing ? (
        <FAB
          icon="plus"
          label="Fiche"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => setComposing(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 16,
  },
});
