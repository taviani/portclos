import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';

import { AuthedImage } from '@/components/AuthedImage';
import { Text, View } from '@/components/Themed';
import {
  useClosing,
  useCompleteClosing,
  useDeleteClosingPhoto,
  useUpdateClosingItem,
  useUploadClosingPhoto,
} from '@/hooks/useClosing';
import { closingPhotoUrl, type ClosingItem } from '@/lib/api';

export default function ClosingRunScreen() {
  const { closingId } = useLocalSearchParams<{ closingId: string }>();
  const closing = useClosing(closingId);
  const updateItem = useUpdateClosingItem(closingId);
  const uploadPhoto = useUploadClosingPhoto(closingId);
  const deletePhoto = useDeleteClosingPhoto(closingId);
  const complete = useCompleteClosing(closingId, closing.data?.house_id);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const items = closing.data?.items ?? [];
    const required = items.filter((i) => !i.optional);
    const doneReq = required.filter((i) => i.status === 'done').length;
    return { doneReq, required: required.length, total: items.length };
  }, [closing.data?.items]);

  if (closing.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!closing.data) {
    return (
      <View style={styles.pad}>
        <Text style={styles.err}>Fermeture introuvable.</Text>
      </View>
    );
  }

  const detail = closing.data;
  const open = detail.status === 'open';

  const setStatus = (item: ClosingItem, status: ClosingItem['status']) => {
    setError(null);
    void updateItem.mutateAsync({ itemId: item.id, status }).catch((e) => {
      const msg = e instanceof Error ? e.message : 'erreur';
      if (msg.includes('photo_required') || msg.includes('400')) {
        setError('Ajoute une photo avant de valider cette tâche.');
      } else if (msg.includes('cannot_skip')) {
        setError('Cette tâche est requise — elle ne peut pas être ignorée.');
      } else {
        setError(msg);
      }
    });
  };

  const addPhoto = async (item: ClosingItem) => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!library.granted) {
        setError('Autorise l’accès à la caméra ou à la photothèque.');
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      exif: false,
    }).catch(async () =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      }),
    );
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      await uploadPhoto.mutateAsync({
        itemId: item.id,
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload impossible');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.meta}>
        {open ? 'En cours' : 'Terminée'} · {progress.doneReq}/{progress.required} requises
      </Text>

      {detail.items.map((item) => {
        const checked = item.status === 'done';
        const skipped = item.status === 'skipped';
        return (
          <View key={item.id} style={styles.item}>
            <Pressable
              disabled={!open || updateItem.isPending}
              onPress={() => setStatus(item, checked ? 'todo' : 'done')}
              style={styles.itemHeader}
            >
              <RNView style={[styles.box, checked && styles.boxOn, skipped && styles.boxSkip]}>
                <Text style={styles.boxMark}>{checked ? '✓' : skipped ? '–' : ''}</Text>
              </RNView>
              <View style={styles.itemCopy}>
                <Text style={[styles.itemTitle, (checked || skipped) && styles.itemDone]}>
                  {item.label}
                </Text>
                <Text style={styles.badges}>
                  {item.optional ? 'Optionnelle' : 'Requise'}
                  {item.requires_photo ? ' · photo requise' : ''}
                </Text>
              </View>
            </Pressable>

            {open ? (
              <View style={styles.actions}>
                {item.optional && !skipped ? (
                  <Pressable onPress={() => setStatus(item, 'skipped')}>
                    <Text style={styles.link}>Ignorer</Text>
                  </Pressable>
                ) : null}
                {skipped ? (
                  <Pressable onPress={() => setStatus(item, 'todo')}>
                    <Text style={styles.link}>Réactiver</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => void addPhoto(item)}
                  disabled={uploadPhoto.isPending}
                >
                  <Text style={styles.link}>Ajouter photo</Text>
                </Pressable>
              </View>
            ) : null}

            {item.photos?.length ? (
              <ScrollView horizontal style={styles.photos} showsHorizontalScrollIndicator={false}>
                {item.photos.map((p) => (
                  <View key={p.id} style={styles.photoWrap}>
                    <AuthedImage
                      url={closingPhotoUrl(p.id)}
                      cacheKey={p.id}
                      style={styles.photo}
                    />
                    {open ? (
                      <Pressable
                        onPress={() => void deletePhoto.mutateAsync(p.id)}
                        style={styles.photoDel}
                      >
                        <Text style={styles.photoDelText}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        );
      })}

      {open ? (
        <Pressable
          style={[styles.button, complete.isPending && styles.disabled]}
          disabled={complete.isPending}
          onPress={() => {
            setError(null);
            void complete.mutateAsync().catch((e) => {
              const msg = e instanceof Error ? e.message : 'erreur';
              if (msg.includes('required_pending') || msg.includes('400')) {
                setError('Termine toutes les tâches requises (avec photo si demandé).');
              } else {
                setError(msg);
              }
            });
          }}
        >
          <Text style={styles.buttonText}>
            {complete.isPending ? '…' : 'Terminer la fermeture'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.doneHint}>Fermeture enregistrée.</Text>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    opacity: 0.55,
    marginBottom: 16,
    fontSize: 13,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#1a1612',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: {
    backgroundColor: '#1a1612',
  },
  boxSkip: {
    borderColor: '#999',
    backgroundColor: '#eee',
  },
  boxMark: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemDone: {
    opacity: 0.45,
    textDecorationLine: 'line-through',
  },
  badges: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.55,
  },
  actions: {
    marginTop: 10,
    marginLeft: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    opacity: 0.7,
    fontSize: 13,
  },
  photos: {
    marginTop: 12,
    marginLeft: 40,
  },
  photoWrap: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  photoDel: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    marginTop: 28,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  doneHint: {
    marginTop: 28,
    opacity: 0.7,
    textAlign: 'center',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
  },
});
