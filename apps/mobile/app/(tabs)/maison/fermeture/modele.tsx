import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  Switch,
  Text,
  TextInput,
  Surface,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import {
  useChecklistItems,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useDeleteChecklistPhoto,
  useUpdateChecklistItem,
  useUploadChecklistPhoto,
} from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';
import { checklistPhotoUrl, type ChecklistItem } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

export default function FermetureModeleScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const items = useChecklistItems(house?.id);
  const createItem = useCreateChecklistItem(house?.id);
  const updateItem = useUpdateChecklistItem(house?.id);
  const deleteItem = useDeleteChecklistItem(house?.id);
  const uploadPhoto = useUploadChecklistPhoto(house?.id);
  const deletePhoto = useDeleteChecklistPhoto(house?.id);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [optional, setOptional] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOptional, setEditOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (it: ChecklistItem) => {
    setEditingId(it.id);
    setEditLabel(it.label);
    setEditDescription(it.description ?? '');
    setEditOptional(it.optional);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditDescription('');
    setEditOptional(false);
  };

  const saveEdit = () => {
    if (!editingId || !editLabel.trim()) return;
    setError(null);
    void updateItem
      .mutateAsync({
        itemId: editingId,
        label: editLabel.trim(),
        description: editDescription.trim(),
        optional: editOptional,
      })
      .then(() => cancelEdit())
      .catch((e) => setError(e instanceof Error ? e.message : 'enregistrement impossible'));
  };

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
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={[styles.pad, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucune maison sélectionnée.</Text>
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
        variant="headlineMedium"
        style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.4 }}
      >
        Modèle
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 18, lineHeight: 24 }}
      >
        Copié à chaque fermeture. Ajoute une description ou une photo pour indiquer où agir.
      </Text>

      {(items.data ?? []).map((it) => {
        const editing = editingId === it.id;
        return (
          <Surface
            key={it.id}
            style={[styles.item, { backgroundColor: theme.colors.elevation.level1 }]}
            elevation={0}
          >
            {editing ? (
              <View>
                <TextInput
                  mode="outlined"
                  label="Libellé"
                  value={editLabel}
                  onChangeText={setEditLabel}
                  style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
                />
                <TextInput
                  mode="outlined"
                  label="Description (optionnel)"
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={3}
                  style={{ backgroundColor: theme.colors.surface }}
                />
                <View style={styles.switchRow}>
                  <Text style={{ color: theme.colors.onSurface }}>Optionnelle</Text>
                  <Switch
                    value={editOptional}
                    onValueChange={setEditOptional}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.editActions}>
                  <Button mode="text" onPress={cancelEdit}>
                    Annuler
                  </Button>
                  <Button
                    mode="contained"
                    onPress={saveEdit}
                    loading={updateItem.isPending}
                    disabled={!editLabel.trim() || updateItem.isPending}
                    style={{ borderRadius: 12 }}
                  >
                    Enregistrer
                  </Button>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.itemTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="titleMedium"
                      style={{ fontWeight: '700', color: theme.colors.onSurface }}
                    >
                      {it.label}
                    </Text>
                    {it.description?.trim() ? (
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          marginTop: 6,
                          lineHeight: 20,
                        }}
                      >
                        {it.description}
                      </Text>
                    ) : null}
                    <Chip compact style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                      {it.optional ? 'Optionnelle' : 'Requise'}
                    </Chip>
                  </View>
                  <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    onPress={() => {
                      Alert.alert('Supprimer cette tâche ?', it.label, [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: 'Supprimer',
                          style: 'destructive',
                          onPress: () => {
                            void deleteItem.mutateAsync(it.id).catch((e) =>
                              setError(
                                e instanceof Error ? e.message : 'suppression impossible',
                              ),
                            );
                          },
                        },
                      ]);
                    }}
                  />
                </View>

                {it.photos?.length ? (
                  <ScrollView
                    horizontal
                    style={styles.photos}
                    showsHorizontalScrollIndicator={false}
                  >
                    {it.photos.map((p) => (
                      <View key={p.id} style={styles.photoWrap}>
                        <AuthedImage
                          url={checklistPhotoUrl(p.id)}
                          cacheKey={p.id}
                          style={styles.photo}
                        />
                        <IconButton
                          icon="close"
                          size={16}
                          style={styles.photoDel}
                          containerColor={theme.colors.scrim}
                          iconColor={theme.colors.onPrimary}
                          onPress={() => void deletePhoto.mutateAsync(p.id)}
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.actions}>
                  <Button mode="text" compact icon="pencil" onPress={() => startEdit(it)}>
                    Modifier
                  </Button>
                  <Button
                    mode="text"
                    compact
                    onPress={() => {
                      void updateItem.mutateAsync({
                        itemId: it.id,
                        label: it.label,
                        description: it.description ?? '',
                        optional: !it.optional,
                      });
                    }}
                  >
                    {it.optional ? 'Rendre requise' : 'Optionnelle'}
                  </Button>
                  <Button
                    mode="text"
                    compact
                    icon="image-plus"
                    onPress={() => pickHintPhoto(it.id)}
                  >
                    Indication
                  </Button>
                </View>
              </>
            )}
          </Surface>
        );
      })}

      <Surface
        style={[styles.addBlock, { backgroundColor: theme.colors.primaryContainer }]}
        elevation={0}
      >
        <Text
          variant="titleMedium"
          style={{ fontWeight: '700', color: theme.colors.onPrimaryContainer, marginBottom: 12 }}
        >
          Nouvelle tâche
        </Text>
        <TextInput
          mode="outlined"
          label="Libellé"
          placeholder="Ex. Fermer le portail"
          value={label}
          onChangeText={setLabel}
          style={{ backgroundColor: theme.colors.surface }}
        />
        <TextInput
          mode="outlined"
          label="Description (optionnel)"
          placeholder="Précisions, emplacement…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ backgroundColor: theme.colors.surface, marginTop: 8 }}
        />
        <View style={styles.switchRow}>
          <Text style={{ color: theme.colors.onPrimaryContainer }}>Optionnelle</Text>
          <Switch value={optional} onValueChange={setOptional} color={theme.colors.primary} />
        </View>
        <Button
          mode="contained"
          icon="plus"
          disabled={!label.trim()}
          loading={createItem.isPending}
          onPress={() => {
            setError(null);
            void createItem
              .mutateAsync({
                label: label.trim(),
                description: description.trim() || undefined,
                optional,
              })
              .then(() => {
                setLabel('');
                setDescription('');
                setOptional(false);
              })
              .catch((e) => setError(e instanceof Error ? e.message : 'création impossible'));
          }}
          style={{ marginTop: 16, borderRadius: 14 }}
          contentStyle={{ minHeight: 48 }}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
        >
          Ajouter
        </Button>
      </Surface>
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 12 }}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: { borderRadius: 18, padding: 12, marginBottom: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  photos: { marginTop: 10 },
  photoWrap: { marginRight: 10, position: 'relative' },
  photo: { width: 92, height: 92, borderRadius: 14 },
  photoDel: { position: 'absolute', top: -4, right: -4, margin: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  addBlock: { marginTop: 14, borderRadius: 20, padding: 16 },
  switchRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
