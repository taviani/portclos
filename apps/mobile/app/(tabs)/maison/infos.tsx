import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { type Href, Stack, router } from 'expo-router';
import { Button, Text, TextInput } from 'react-native-paper';

import { MenuRow } from '@/components/MenuRow';
import { useCurrentHouse, useUpdateHouse } from '@/hooks/useHouses';
import { useAppTheme } from '@/theme/paper';

export default function MaisonInfosScreen() {
  const theme = useAppTheme();
  const { house } = useCurrentHouse();
  const updateHouse = useUpdateHouse(house?.id);
  const isOwner = house?.role === 'owner';

  const [addressDraft, setAddressDraft] = useState('');
  const [singleBedsDraft, setSingleBedsDraft] = useState('0');
  const [doubleBedsDraft, setDoubleBedsDraft] = useState('0');
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingBeds, setEditingBeds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!house || editingAddress || editingBeds) return;
    setAddressDraft(house.address ?? '');
    setSingleBedsDraft(String(house.single_beds ?? 0));
    setDoubleBedsDraft(String(house.double_beds ?? 0));
  }, [house, editingAddress, editingBeds]);

  const startAddressEdit = useCallback(() => {
    if (!isOwner) return;
    setAddressDraft(house?.address ?? '');
    setEditingBeds(false);
    setEditingAddress(true);
    setSaved(null);
    setError(null);
  }, [house?.address, isOwner]);

  const startBedsEdit = useCallback(() => {
    if (!isOwner) return;
    setSingleBedsDraft(String(house?.single_beds ?? 0));
    setDoubleBedsDraft(String(house?.double_beds ?? 0));
    setEditingAddress(false);
    setEditingBeds(true);
    setSaved(null);
    setError(null);
  }, [house?.double_beds, house?.single_beds, isOwner]);

  const saveAddress = useCallback(async () => {
    setError(null);
    try {
      await updateHouse.mutateAsync({ address: addressDraft.trim() });
      setEditingAddress(false);
      setSaved('Adresse enregistrée.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'enregistrement impossible');
    }
  }, [addressDraft, updateHouse]);

  const saveBeds = useCallback(async () => {
    const s = parseInt(singleBedsDraft, 10);
    const d = parseInt(doubleBedsDraft, 10);
    if (Number.isNaN(s) || s < 0 || Number.isNaN(d) || d < 0) {
      setError('Nombre de lits invalide');
      return;
    }
    setError(null);
    try {
      await updateHouse.mutateAsync({ single_beds: s, double_beds: d });
      setEditingBeds(false);
      setSaved('Capacité enregistrée.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'enregistrement impossible');
    }
  }, [doubleBedsDraft, singleBedsDraft, updateHouse]);

  if (!house) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Réglages' }} />
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucune maison.</Text>
      </View>
    );
  }

  const address = house.address?.trim() || '';
  const s = house.single_beds ?? 0;
  const d = house.double_beds ?? 0;
  const bedLabel =
    s + d <= 0
      ? 'Non configurée'
      : [
          s > 0 ? `${s} simple${s > 1 ? 's' : ''}` : null,
          d > 0 ? `${d} double${d > 1 ? 's' : ''}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <Stack.Screen options={{ title: 'Réglages' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontWeight: '600',
            marginBottom: 20,
          }}
        >
          {house.name}
        </Text>

        <Text
          variant="labelLarge"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Maison
        </Text>

        <MenuRow
          title="Adresse"
          subtitle={address || 'Non renseignée'}
          icon="map-marker-outline"
          onPress={startAddressEdit}
        />
        {editingAddress ? (
          <View style={[styles.editor, { backgroundColor: theme.colors.elevation.level1 }]}>
            <TextInput
              mode="outlined"
              label="Adresse"
              multiline
              value={addressDraft}
              onChangeText={setAddressDraft}
              style={{ backgroundColor: theme.colors.surface, minHeight: 88 }}
            />
            <View style={styles.actions}>
              <Button compact onPress={() => setEditingAddress(false)}>
                Annuler
              </Button>
              <Button
                compact
                mode="contained"
                loading={updateHouse.isPending}
                onPress={() => void saveAddress()}
              >
                Enregistrer
              </Button>
            </View>
          </View>
        ) : null}

        <MenuRow
          title="Capacité"
          subtitle={bedLabel}
          icon="bed-outline"
          onPress={startBedsEdit}
        />
        {editingBeds ? (
          <View style={[styles.editor, { backgroundColor: theme.colors.elevation.level1 }]}>
            <View style={styles.bedRow}>
              <TextInput
                mode="outlined"
                label="Lits simples"
                keyboardType="number-pad"
                value={singleBedsDraft}
                onChangeText={setSingleBedsDraft}
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
              <TextInput
                mode="outlined"
                label="Lits doubles"
                keyboardType="number-pad"
                value={doubleBedsDraft}
                onChangeText={setDoubleBedsDraft}
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
              />
            </View>
            <View style={styles.actions}>
              <Button compact onPress={() => setEditingBeds(false)}>
                Annuler
              </Button>
              <Button
                compact
                mode="contained"
                loading={updateHouse.isPending}
                onPress={() => void saveBeds()}
              >
                Enregistrer
              </Button>
            </View>
          </View>
        ) : null}

        {!isOwner ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline, marginTop: 4, marginBottom: 8, lineHeight: 18 }}
          >
            Seul un propriétaire peut modifier l’adresse et la capacité.
          </Text>
        ) : null}

        <Text
          variant="labelLarge"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, marginTop: 20 }]}
        >
          Fermeture
        </Text>
        <MenuRow
          title="Checklist"
          subtitle="Étapes et photos d’indication"
          icon="clipboard-list-outline"
          onPress={() => router.push('/(tabs)/maison/checklist-modele' as Href)}
        />

        {saved ? (
          <Text style={{ color: theme.colors.primary, marginTop: 16 }}>{saved}</Text>
        ) : null}
        {error ? (
          <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  editor: {
    marginTop: -4,
    marginBottom: 10,
    marginLeft: 6,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bedRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
