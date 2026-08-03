import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { type Href, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  FAB,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import { MemberMentionPicker } from '@/components/blog/MemberMentionPicker';
import { TagPicker } from '@/components/blog/TagPicker';
import { BeaconRail } from '@/components/brand/BeaconRail';
import { useBlogPosts, useCreateBlogPost, useUploadBlogPhoto } from '@/hooks/useBlog';
import { useCurrentHouse, useHouseMembers } from '@/hooks/useHouses';
import { blogPhotoUrl } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BlogListScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const posts = useBlogPosts(house?.id);
  const members = useHouseMembers(house?.id);
  const createPost = useCreateBlogPost(house?.id);
  const uploadPhoto = useUploadBlogPhoto(house?.id);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetComposer = () => {
    setTitle('');
    setBody('');
    setTags([]);
    setTagDraft('');
    setMentions([]);
    setPendingPhoto(null);
    setComposing(false);
  };

  const pickPhoto = () => {
    Alert.alert('Photo', undefined, [
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
              setPendingPhoto({
                uri: result.assets[0].uri,
                mimeType: result.assets[0].mimeType,
              });
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
              setPendingPhoto({
                uri: result.assets[0].uri,
                mimeType: result.assets[0].mimeType,
              });
            }
          })();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const publish = async () => {
    if (!title.trim()) return;
    setError(null);
    try {
      const post = await createPost.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        tags,
        mentions,
      });
      if (pendingPhoto) {
        await uploadPhoto.mutateAsync({
          postId: post.id,
          uri: pendingPhoto.uri,
          mimeType: pendingPhoto.mimeType,
        });
      }
      resetComposer();
      router.push(`/(tabs)/maison/blog/${post.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'publication impossible');
    }
  };

  if (isLoading || posts.isLoading) {
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
          Nouvelles et souvenirs de la maison — visibles par les membres.
        </Text>

        {composing ? (
          <View style={{ marginBottom: 24 }}>
            <TextInput
              mode="outlined"
              label="Titre"
              value={title}
              onChangeText={setTitle}
              style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
            />
            <TextInput
              mode="outlined"
              label="Texte"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              style={{ backgroundColor: theme.colors.surface, marginBottom: 12 }}
            />

            <TagPicker
              tags={tags}
              draft={tagDraft}
              onDraftChange={setTagDraft}
              onChange={setTags}
              onInvalid={setError}
            />
            <MemberMentionPicker
              members={members.data ?? []}
              selected={mentions}
              loading={members.isLoading}
              onChange={setMentions}
            />

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 12 }}>
              <Button mode="outlined" icon="image" onPress={pickPhoto}>
                {pendingPhoto ? 'Photo choisie' : 'Ajouter une photo'}
              </Button>
              {pendingPhoto ? (
                <Button mode="text" onPress={() => setPendingPhoto(null)}>
                  Retirer
                </Button>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="text" onPress={resetComposer}>
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={() => void publish()}
                loading={createPost.isPending || uploadPhoto.isPending}
                disabled={!title.trim() || createPost.isPending}
                style={{ borderRadius: 12 }}
              >
                Publier
              </Button>
            </View>
          </View>
        ) : null}

        {(posts.data ?? []).length === 0 ? (
          <Text style={{ color: theme.colors.outline }}>
            Aucune publication pour l’instant. Lance la première !
          </Text>
        ) : (
          (posts.data ?? []).map((p) => {
            const cover = p.photos[0];
            const tagLine = (p.tags ?? []).map((t) => `#${t}`).join(' ');
            const mentionLine = (p.mentions ?? [])
              .map((m) => `@${m.display_name}`)
              .join(' ');
            const reactionSummary = (p.reactions ?? [])
              .map((r) => `${r.emoji}${r.count > 1 ? r.count : ''}`)
              .join(' ');
            const extras = [tagLine, mentionLine, reactionSummary].filter(Boolean).join(' · ');
            return (
              <View key={p.id} style={styles.row}>
                <BeaconRail />
                <List.Item
                  title={p.title}
                  description={`${p.author_name || 'Membre'} · ${formatWhen(p.created_at)}${
                    extras ? `\n${extras}` : ''
                  }`}
                  descriptionNumberOfLines={4}
                  onPress={() => router.push(`/(tabs)/maison/blog/${p.id}` as Href)}
                  left={() =>
                    cover ? (
                      <AuthedImage
                        url={blogPhotoUrl(cover.id)}
                        cacheKey={`blog-thumb-${cover.id}`}
                        style={styles.thumb}
                      />
                    ) : (
                      <List.Icon icon="newspaper-variant-outline" color={theme.colors.primary} />
                    )
                  }
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.elevation.level1,
                    borderTopRightRadius: theme.roundness,
                    borderBottomRightRadius: theme.roundness,
                  }}
                  titleStyle={{ fontWeight: '700', color: theme.colors.onSurface }}
                  descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                />
              </View>
            );
          })
        )}

        {error ? (
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>{error}</Text>
        ) : null}
        {posts.error instanceof Error ? (
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>{posts.error.message}</Text>
        ) : null}
      </ScrollView>

      {!composing ? (
        <FAB
          icon="plus"
          label="Publier"
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
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginLeft: 8,
    marginRight: 4,
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 16,
  },
});
