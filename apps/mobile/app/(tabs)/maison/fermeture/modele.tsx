import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import {
  useChecklistItems,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';

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

  const [label, setLabel] = useState('');
  const [optional, setOptional] = useState(false);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        Ces tâches sont copiées à chaque nouvelle fermeture. Les optionnelles peuvent être
        ignorées ; « photo requise » bloque la validation sans image.
      </Text>

      {(items.data ?? []).map((it) => (
        <View key={it.id} style={styles.item}>
          <Text style={styles.itemTitle}>{it.label}</Text>
          <Text style={styles.meta}>
            {it.optional ? 'Optionnelle' : 'Requise'}
            {it.requires_photo ? ' · photo requise' : ''}
          </Text>
          <View style={styles.itemActions}>
            <Pressable
              onPress={() => {
                void updateItem.mutateAsync({
                  itemId: it.id,
                  label: it.label,
                  optional: !it.optional,
                  requires_photo: it.requires_photo,
                });
              }}
            >
              <Text style={styles.link}>
                {it.optional ? 'Rendre requise' : 'Rendre optionnelle'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void updateItem.mutateAsync({
                  itemId: it.id,
                  label: it.label,
                  optional: it.optional,
                  requires_photo: !it.requires_photo,
                });
              }}
            >
              <Text style={styles.link}>
                {it.requires_photo ? 'Sans photo' : 'Exiger photo'}
              </Text>
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
      <View style={styles.switchRow}>
        <Text>Photo requise</Text>
        <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} />
      </View>
      <Pressable
        style={[styles.button, (!label.trim() || createItem.isPending) && styles.disabled]}
        disabled={!label.trim() || createItem.isPending}
        onPress={() => {
          setError(null);
          void createItem
            .mutateAsync({
              label: label.trim(),
              optional,
              requires_photo: requiresPhoto,
            })
            .then(() => {
              setLabel('');
              setOptional(false);
              setRequiresPhoto(false);
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
