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
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';
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
  const inputBorder = useThemeColor({ light: Brand.line, dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: Brand.white, dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: Brand.inkMuted, dark: '#8e8e93' }, 'text');
  const surface = useThemeColor({ light: Brand.surface, dark: '#1c1c1e' }, 'background');

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
    Alert.alert('Photo d’indication', 'Montre où ou comment faire la tâche.', [
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
        <ActivityIndicator color={Brand.ink} />
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
      <Text style={styles.heading}>Modèle</Text>
      <Text style={styles.lead}>
        Copié à chaque fermeture. Ajoute une photo pour indiquer où agir.
      </Text>

      {(items.data ?? []).map((it) => (
        <View key={it.id} style={[styles.item, { backgroundColor: surface }]}>
          <View style={styles.itemTop}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{it.label}</Text>
              <Text style={styles.meta}>{it.optional ? 'Optionnelle' : 'Requise'}</Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert('Supprimer cette tâche ?', it.label, [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                      void deleteItem.mutateAsync(it.id).catch((e) =>
                        setError(e instanceof Error ? e.message : 'suppression impossible'),
                      );
                    },
                  },
                ]);
              }}
              hitSlop={10}
            >
              <Text style={styles.delete}>Suppr.</Text>
            </Pressable>
          </View>

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
                {it.optional ? 'Rendre requise' : 'Optionnelle'}
              </Text>
            </Pressable>
            <Pressable onPress={() => pickHintPhoto(it.id)}>
              <Text style={styles.link}>+ Indication</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={[styles.addBlock, { backgroundColor: surface }]}>
        <Text style={styles.addTitle}>Nouvelle tâche</Text>
        <TextInput
          style={[
            styles.input,
            { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg },
          ]}
          placeholder="Ex. Fermer le portail"
          placeholderTextColor={placeholderColor}
          value={label}
          onChangeText={setLabel}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Optionnelle</Text>
          <Switch
            value={optional}
            onValueChange={setOptional}
            trackColor={{ true: Brand.ink }}
          />
        </View>
        <PrimaryButton
          label="Ajouter"
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
          disabled={!label.trim()}
          busy={createItem.isPending}
          style={styles.addBtn}
        />
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lead: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.62,
  },
  item: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  photos: {
    marginTop: 12,
  },
  photoWrap: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  photoDel: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(26,22,18,0.7)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDelText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '700',
  },
  itemActions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  delete: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  addBlock: {
    marginTop: 18,
    borderRadius: 18,
    padding: 16,
  },
  addTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  addBtn: {
    marginTop: 18,
  },
  hint: {
    opacity: 0.55,
  },
  err: {
    marginTop: 12,
    color: Brand.danger,
  },
});
