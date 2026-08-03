import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import { PostMetaChips } from '@/components/blog/PostMetaChips';
import {
  useAddBlogComment,
  useBlogPost,
  useClearBlogReaction,
  useDeleteBlogComment,
  useDeleteBlogPost,
  useSetBlogReaction,
  useUploadBlogPhoto,
} from '@/hooks/useBlog';
import { useCurrentHouse, useMe } from '@/hooks/useHouses';
import { blogPhotoUrl } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🏠', '🙏'];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BlogPostScreen() {
  const theme = useAppTheme();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { house } = useCurrentHouse();
  const me = useMe();
  const post = useBlogPost(postId);
  const addComment = useAddBlogComment();
  const deleteComment = useDeleteBlogComment();
  const setReaction = useSetBlogReaction(house?.id);
  const clearReaction = useClearBlogReaction(house?.id);
  const deletePost = useDeleteBlogPost(house?.id);
  const uploadPhoto = useUploadBlogPhoto(house?.id);

  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const data = post.data;
  const isAuthor = !!data && !!me.data && data.author_sub === me.data.sub;

  const onReact = async (emoji: string) => {
    if (!postId) return;
    setError(null);
    const mine = data?.reactions.find((r) => r.mine);
    try {
      if (mine?.emoji === emoji) {
        await clearReaction.mutateAsync(postId);
      } else {
        await setReaction.mutateAsync({ postId, emoji });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'réaction impossible');
    }
  };

  const onComment = async () => {
    if (!postId || !comment.trim()) return;
    setError(null);
    try {
      await addComment.mutateAsync({ postId, body: comment.trim() });
      setComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'commentaire impossible');
    }
  };

  const onAddPhoto = () => {
    if (!postId) return;
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
                  postId,
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
                  postId,
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

  const onDeletePost = () => {
    if (!postId) return;
    Alert.alert('Supprimer cette publication ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void deletePost
            .mutateAsync(postId)
            .then(() => router.back())
            .catch((e) => {
              setError(e instanceof Error ? e.message : 'suppression impossible');
            });
        },
      },
    ]);
  };

  if (post.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.pad, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>
          {post.error instanceof Error ? post.error.message : 'Publication introuvable'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.pad}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        variant="headlineSmall"
        style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.3 }}
      >
        {data.title}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, marginBottom: 10 }}
      >
        {data.author_name || 'Membre'} · {formatWhen(data.created_at)}
      </Text>

      <PostMetaChips tags={data.tags} mentions={data.mentions} />

      {data.body ? (
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurface, lineHeight: 26, marginBottom: 16 }}
        >
          {data.body}
        </Text>
      ) : null}

      {data.photos.map((ph) => (
        <AuthedImage
          key={ph.id}
          url={blogPhotoUrl(ph.id)}
          cacheKey={`blog-${ph.id}`}
          style={styles.photo}
        />
      ))}

      {isAuthor ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Button mode="outlined" icon="image-plus" onPress={onAddPhoto} compact>
            Photo
          </Button>
          <Button mode="text" textColor={theme.colors.error} onPress={onDeletePost} compact>
            Supprimer
          </Button>
        </View>
      ) : null}

      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 0.5, marginBottom: 8 }}
      >
        RÉACTIONS
      </Text>
      <View style={styles.reactionRow}>
        {REACTIONS.map((emoji) => {
          const existing = data.reactions.find((r) => r.emoji === emoji);
          return (
            <Chip
              key={emoji}
              selected={!!existing?.mine}
              onPress={() => void onReact(emoji)}
              style={{ marginRight: 6, marginBottom: 6 }}
              compact
            >
              {emoji}
              {existing && existing.count > 0 ? ` ${existing.count}` : ''}
            </Chip>
          );
        })}
      </View>

      <Text
        variant="labelLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          letterSpacing: 0.5,
          marginTop: 20,
          marginBottom: 8,
        }}
      >
        COMMENTAIRES
      </Text>
      {(data.comments ?? []).length === 0 ? (
        <Text style={{ color: theme.colors.outline, marginBottom: 12 }}>
          Sois le premier à commenter.
        </Text>
      ) : (
        (data.comments ?? []).map((c) => (
          <View
            key={c.id}
            style={[styles.comment, { backgroundColor: theme.colors.elevation.level1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                {c.author_name || 'Membre'}
              </Text>
              <Text style={{ color: theme.colors.onSurface, marginTop: 2, lineHeight: 22 }}>
                {c.body}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                {formatWhen(c.created_at)}
              </Text>
            </View>
            {me.data?.sub === c.author_sub ? (
              <IconButton
                icon="delete-outline"
                size={18}
                onPress={() => {
                  void deleteComment
                    .mutateAsync({ commentId: c.id, postId: data.id })
                    .catch((e) => {
                      setError(e instanceof Error ? e.message : 'suppression impossible');
                    });
                }}
              />
            ) : null}
          </View>
        ))
      )}

      <TextInput
        mode="outlined"
        label="Ton commentaire"
        value={comment}
        onChangeText={setComment}
        multiline
        style={{ backgroundColor: theme.colors.surface, marginTop: 8 }}
      />
      <Button
        mode="contained"
        onPress={() => void onComment()}
        loading={addComment.isPending}
        disabled={!comment.trim() || addComment.isPending}
        style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 12 }}
      >
        Commenter
      </Button>

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
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
});
