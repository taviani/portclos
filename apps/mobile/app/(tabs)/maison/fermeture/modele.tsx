import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View as RNView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AuthedImage } from '@/components/AuthedImage';
import { Text, View, useThemeColor } from '@/components/Themed';
import {
  useChecklistItems,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useDeleteChecklistPhoto,
  useUpdateChecklistItem,
  useUploadChecklistPhoto,
} from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';
import { checklistPhotoUrl } from '@/lib/api';

export default function FermetureModeleScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');

  const { house, isLoading } = useCurrentHouse();
  const items = useChecklistItems(house?.id);
  const createItem = useCreateChecklistItem(house?.id);
  const updateItem = useUpdateChecklistItem(house?.id);
  const deleteItem = useDeleteChecklistItem(house?.id);
  const uploadPhoto = useUploadChecklistPhoto(house?.id);
  const deletePhoto = useDeleteChecklistPhoto(house?.id);

  const [label, setLabel] = useState('');
  const [optional, setOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFromAsset = async (
    itemId: string,
    asset: ImagePicker.ImagePickerAsset,
  ) => {
    try {
      await uploadPhoto.mutateAsync({
        itemId,
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload impossible');
    }
  };

  const pickHintPhoto = (itemId: string) => {
    setError(null);
    Alert.alert('Photo d’indication', 'Montre où / comment faire la tâche.', [
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
              quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
              await uploadFromAsset(itemId, result.assets[0]);
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
              quality: 0.7,
              exif: false,
            });
            if (!result.canceled && result.assets[0]) {
              await uploadFromAsset(itemId, result.assets[0]);
            }
          })();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  if (isLoading || items.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.pad}>
        <Text style={styles.hint}>Aucune maison sélectionnée.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.lead}>
        Ces tâches sont copiées à chaque fermeture. Ajoute des photos d’indication pour montrer
        où agir (compteur, vanne, etc.).
      </Text>

      {(items.data ?? []).map((it) => (
        <View key={it.id} style={styles.item}>
          <Text style={styles.itemTitle}>{it.label}</Text>
          <Text style={styles.meta}>{it.optional ? 'Optionnelle' : 'Requise'}</Text>

          {it.photos?.length ? (
            <ScrollView horizontal style={styles.photos} showsHorizontalScrollIndicator={false}>
              {it.photos.map((p) => (
                <RNView key={p.id} style={styles.photoWrap}>
                  <AuthedImage
                    url={checklistPhotoUrl(p.id)}
                    cacheKey={p.id}
                    style={styles.photo}
                  />
                  <Pressable
                    onPress={() => void deletePhoto.mutateAsync(p.id)}
                    style={styles.photoDel}
                  >
                    <Text style={styles.photoDelText}>×</Text>
                  </Pressable>
                </RNView>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.itemActions}>
            <Pressable
              onPress={() => {
                void updateItem.mutateAsync({
                  itemId: it.id,
                  label: it.label,
                  optional: !it.optional,
                });
              }}
            >
              <Text style={styles.link}>
                {it.optional ? 'Rendre requise' : 'Rendre optionnelle'}
              </Text>
            </Pressable>
            <Pressable onPress={() => void pickHintPhoto(it.id)}>
              <Text style={styles.link}>Photo d’indication</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void deleteItem.mutateAsync(it.id).catch((e) =>
                  setError(e instanceof Error ? e.message : 'suppression impossible'),
                );
              }}
            >
              <Text style={styles.delete}>Suppr.</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.section}>Ajouter une tâche</Text>
      <TextInput
        style={[
          styles.input,
          { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg },
        ]}
        placeholder="Libellé"
        placeholderTextColor={placeholderColor}
        value={label}
        onChangeText={setLabel}
      />
      <View style={styles.switchRow}>
        <Text>Optionnelle</Text>
        <Switch value={optional} onValueChange={setOptional} />
      </View>
      <Pressable
        style={[styles.button, (!label.trim() || createItem.isPending) && styles.disabled]}
        disabled={!label.trim() || createItem.isPending}
        onPress={() => {
          setError(null);
          void createItem
            .mutateAsync({ label: label.trim(), optional })
            .then(() => {
              setLabel('');
              setOptional(false);
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'création impossible'));
        }}
      >
        <Text style={styles.buttonText}>Ajouter</Text>
      </Pressable>
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
  lead: {
    opacity: 0.7,
    lineHeight: 22,
    marginBottom: 20,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.55,
  },
  photos: {
    marginTop: 10,
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
  itemActions: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  link: {
    opacity: 0.7,
    fontSize: 13,
  },
  delete: {
    color: '#9b1c1c',
    fontSize: 13,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  hint: {
    opacity: 0.55,
  },
  err: {
    marginTop: 12,
    color: '#9b1c1c',
  },
});
