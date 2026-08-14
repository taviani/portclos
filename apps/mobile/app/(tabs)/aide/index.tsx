import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { type Href, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  FAB,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  useCreateHelpArticle,
  useHelpArticles,
  useUploadHelpDocument,
  useUploadHelpPhoto,
} from '@/hooks/useHelp';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useAppTheme } from '@/theme/paper';

type PendingImage = { uri: string; mimeType?: string | null };
type PendingDoc = {
  uri: string;
  mimeType?: string | null;
  name: string;
};

export default function AideListScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const articles = useHelpArticles(house?.id);
  const createArticle = useCreateHelpArticle(house?.id);
  const uploadPhoto = useUploadHelpPhoto(house?.id);
  const uploadDocument = useUploadHelpDocument(house?.id);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetComposer = () => {
    setTitle('');
    setBody('');
    setPendingImages([]);
    setPendingDocs([]);
    setComposing(false);
    setError(null);
  };

  const pickImages = () => {
    Alert.alert('Ajouter des images', undefined, [
      {
        text: 'Photothèque',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              setError('Autorise l’accès à la photothèque.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.75,
              allowsMultipleSelection: true,
              selectionLimit: 10,
            });
            if (!result.canceled && result.assets.length > 0) {
              setPendingImages((prev) => [
                ...prev,
                ...result.assets.map((a) => ({
                  uri: a.uri,
                  mimeType: a.mimeType,
                })),
              ]);
            }
          })();
        },
      },
      {
        text: 'Caméra',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              setError('Autorise l’accès à la caméra.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.75,
              exif: false,
            });
            if (!result.canceled && result.assets[0]) {
              setPendingImages((prev) => [
                ...prev,
                {
                  uri: result.assets[0].uri,
                  mimeType: result.assets[0].mimeType,
                },
              ]);
            }
          })();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const pickDocument = () => {
    void (async () => {
      setError(null);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ],
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (result.canceled || !result.assets?.length) return;
        setPendingDocs((prev) => [
          ...prev,
          ...result.assets.map((a) => ({
            uri: a.uri,
            mimeType: a.mimeType,
            name: a.name || 'document',
          })),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'sélection impossible');
      }
    })();
  };

  const create = async () => {
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const a = await createArticle.mutateAsync({
        title: title.trim(),
        body: body.trim(),
      });
      for (const img of pendingImages) {
        await uploadPhoto.mutateAsync({
          articleId: a.id,
          uri: img.uri,
          mimeType: img.mimeType,
        });
      }
      for (const doc of pendingDocs) {
        await uploadDocument.mutateAsync({
          articleId: a.id,
          uri: doc.uri,
          mimeType: doc.mimeType,
          fileName: doc.name,
        });
      }
      resetComposer();
      router.push(`/(tabs)/aide/${a.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'création impossible');
    } finally {
      setSaving(false);
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

            {pendingImages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {pendingImages.map((img, i) => (
                  <View key={`${img.uri}-${i}`}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Button
                      mode="text"
                      compact
                      textColor={theme.colors.error}
                      onPress={() =>
                        setPendingImages((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Retirer
                    </Button>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {pendingDocs.map((doc, i) => (
              <List.Item
                key={`${doc.uri}-${i}`}
                title={doc.name}
                left={(props) => <List.Icon {...props} icon="file-document-outline" />}
                right={() => (
                  <Button
                    mode="text"
                    textColor={theme.colors.error}
                    compact
                    onPress={() =>
                      setPendingDocs((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Retirer
                  </Button>
                )}
                style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 12,
                  marginBottom: 6,
                }}
              />
            ))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <Button mode="outlined" icon="image-plus" onPress={pickImages}>
                Images
              </Button>
              <Button mode="outlined" icon="file-document-outline" onPress={pickDocument}>
                Document
              </Button>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="text" onPress={resetComposer} disabled={saving}>
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={() => void create()}
                loading={saving || createArticle.isPending}
                disabled={!title.trim() || saving || createArticle.isPending}
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
            onPress={() => router.push(`/(tabs)/aide/${a.id}` as Href)}
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
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
  },
});
