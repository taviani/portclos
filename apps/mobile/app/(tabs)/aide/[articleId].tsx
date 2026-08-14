import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import { useCurrentHouse } from '@/hooks/useHouses';
import {
  useDeleteHelpArticle,
  useDeleteHelpDocument,
  useHelpArticle,
  useUpdateHelpArticle,
  useUploadHelpDocument,
  useUploadHelpPhoto,
} from '@/hooks/useHelp';
import { helpDocumentUrl, helpPhotoUrl, type HelpDocument } from '@/lib/api';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export default function AideArticleScreen() {
  const theme = useAppTheme();
  const { token } = useSession();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const { house } = useCurrentHouse();
  const article = useHelpArticle(articleId);
  const update = useUpdateHelpArticle(house?.id);
  const remove = useDeleteHelpArticle(house?.id);
  const uploadPhoto = useUploadHelpPhoto(house?.id);
  const uploadDocument = useUploadHelpDocument(house?.id);
  const deleteDocument = useDeleteHelpDocument(house?.id, articleId);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  useEffect(() => {
    if (article.data) {
      setTitle(article.data.title);
      setBody(article.data.body);
    }
  }, [article.data]);

  const save = async () => {
    if (!articleId || !title.trim()) return;
    setError(null);
    try {
      await update.mutateAsync({
        articleId,
        title: title.trim(),
        body: body.trim(),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'enregistrement impossible');
    }
  };

  const onAddPhoto = () => {
    if (!articleId) return;
    Alert.alert('Ajouter une photo', undefined, [
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
            });
            if (!result.canceled && result.assets[0]) {
              try {
                await uploadPhoto.mutateAsync({
                  articleId,
                  uri: result.assets[0].uri,
                  mimeType: result.assets[0].mimeType,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'upload impossible');
              }
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
              try {
                await uploadPhoto.mutateAsync({
                  articleId,
                  uri: result.assets[0].uri,
                  mimeType: result.assets[0].mimeType,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'upload impossible');
              }
            }
          })();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const onAddDocument = () => {
    if (!articleId) return;
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
          multiple: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        await uploadDocument.mutateAsync({
          articleId,
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.name,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'upload impossible');
      }
    })();
  };

  const onOpenDocument = (doc: HelpDocument) => {
    if (!token) return;
    void (async () => {
      setError(null);
      setOpeningDocId(doc.id);
      try {
        const ext =
          doc.original_filename.includes('.')
            ? doc.original_filename.slice(doc.original_filename.lastIndexOf('.'))
            : '.bin';
        const dest = new File(Paths.cache, `help-doc-${doc.id}${ext}`);
        const file = await File.downloadFileAsync(helpDocumentUrl(doc.id), dest, {
          headers: { Authorization: `Bearer ${token}` },
          idempotent: true,
        });
        if (!(await Sharing.isAvailableAsync())) {
          setError('Ouverture de fichier indisponible sur cet appareil.');
          return;
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: doc.content_type,
          dialogTitle: doc.original_filename || 'Document',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ouverture impossible');
      } finally {
        setOpeningDocId(null);
      }
    })();
  };

  const onDeleteDocument = (doc: HelpDocument) => {
    Alert.alert('Supprimer ce document ?', doc.original_filename || undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void deleteDocument.mutateAsync(doc.id).catch((e) => {
            setError(e instanceof Error ? e.message : 'suppression impossible');
          });
        },
      },
    ]);
  };

  const onDelete = () => {
    if (!articleId) return;
    Alert.alert('Supprimer cette fiche ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void remove
            .mutateAsync(articleId)
            .then(() => router.back())
            .catch((e) => {
              setError(e instanceof Error ? e.message : 'suppression impossible');
            });
        },
      },
    ]);
  };

  if (article.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!article.data) {
    return (
      <View style={[styles.pad, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>
          {article.error instanceof Error ? article.error.message : 'Fiche introuvable'}
        </Text>
      </View>
    );
  }

  const documents = article.data.documents ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.pad}
      keyboardShouldPersistTaps="handled"
    >
      {editing ? (
        <>
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
            numberOfLines={10}
            style={{ backgroundColor: theme.colors.surface, minHeight: 180 }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button mode="text" onPress={() => setEditing(false)}>
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={() => void save()}
              loading={update.isPending}
              disabled={!title.trim() || update.isPending}
              style={{ borderRadius: 12 }}
            >
              Enregistrer
            </Button>
          </View>
        </>
      ) : (
        <>
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.3 }}
          >
            {article.data.title}
          </Text>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurface,
              lineHeight: 26,
              marginTop: 14,
              marginBottom: 16,
            }}
          >
            {article.data.body || 'Pas encore de contenu — édite pour compléter.'}
          </Text>
        </>
      )}

      {(article.data.photos ?? []).map((ph) => (
        <AuthedImage
          key={ph.id}
          url={helpPhotoUrl(ph.id)}
          cacheKey={`help-${ph.id}`}
          style={styles.photo}
        />
      ))}

      {documents.length > 0 ? (
        <View style={{ marginBottom: 12, gap: 8 }}>
          <Text
            variant="titleSmall"
            style={{ color: theme.colors.onBackground, fontWeight: '700' }}
          >
            Documents
          </Text>
          {documents.map((doc) => (
            <View
              key={doc.id}
              style={[
                styles.docRow,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Pressable
                onPress={() => onOpenDocument(doc)}
                style={{ flex: 1, paddingVertical: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${doc.original_filename || 'document'}`}
              >
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                  numberOfLines={2}
                >
                  {doc.original_filename || 'Document'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {openingDocId === doc.id ? 'Ouverture…' : 'Appuyer pour ouvrir'}
                </Text>
              </Pressable>
              <Button
                mode="text"
                textColor={theme.colors.error}
                compact
                onPress={() => onDeleteDocument(doc)}
                disabled={deleteDocument.isPending}
              >
                Retirer
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      {!editing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <Button mode="contained-tonal" icon="pencil" onPress={() => setEditing(true)}>
            Modifier
          </Button>
          <Button mode="outlined" icon="image-plus" onPress={onAddPhoto}>
            Photo
          </Button>
          <Button
            mode="outlined"
            icon="file-document-outline"
            onPress={onAddDocument}
            loading={uploadDocument.isPending}
            disabled={uploadDocument.isPending}
          >
            Document
          </Button>
          <Button mode="text" textColor={theme.colors.error} onPress={onDelete}>
            Supprimer
          </Button>
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 14 }}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 6,
  },
});
