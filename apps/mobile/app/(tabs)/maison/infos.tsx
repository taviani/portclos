import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Button, Text, TextInput } from 'react-native-paper';

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
    setAddressDraft(house?.address ?? '');
    setEditingAddress(true);
    setSaved(null);
    setError(null);
  }, [house?.address]);

  const startBedsEdit = useCallback(() => {
    setSingleBedsDraft(String(house?.single_beds ?? 0));
    setDoubleBedsDraft(String(house?.double_beds ?? 0));
    setEditingBeds(true);
    setSaved(null);
    setError(null);
  }, [house?.double_beds, house?.single_beds]);

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
        <Stack.Screen options={{ title: 'Infos' }} />
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
      <Stack.Screen options={{ title: 'Infos maison' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text
          variant="headlineSmall"
          style={{
            color: theme.colors.onBackground,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}
        >
          {house.name}
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, marginBottom: 28 }}
        >
          Adresse et capacité — utilisées pour les présences et la vie de la maison.
        </Text>

        <Text
          variant="labelLarge"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Adresse
        </Text>
        {editingAddress && isOwner ? (
          <View style={styles.form}>
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
                mode="contained-tonal"
                loading={updateHouse.isPending}
                onPress={() => void saveAddress()}
              >
                Enregistrer
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.block}>
            <Text
              variant="bodyLarge"
              style={{
                color: address ? theme.colors.onBackground : theme.colors.outline,
                lineHeight: 24,
              }}
            >
              {address || 'Non renseignée'}
            </Text>
            {isOwner ? (
              <Button
                mode="text"
                compact
                icon="pencil-outline"
                onPress={startAddressEdit}
                style={{ alignSelf: 'flex-start', marginTop: 4, marginLeft: -8 }}
              >
                {address ? 'Modifier' : 'Définir'}
              </Button>
            ) : null}
          </View>
        )}

        <Text
          variant="labelLarge"
          style={[
            styles.sectionLabel,
            { color: theme.colors.onSurfaceVariant, marginTop: 28 },
          ]}
        >
          Capacité
        </Text>
        {editingBeds && isOwner ? (
          <View style={styles.form}>
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
                mode="contained-tonal"
                loading={updateHouse.isPending}
                onPress={() => void saveBeds()}
              >
                Enregistrer
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.block}>
            <Text
              variant="bodyLarge"
              style={{
                color:
                  s + d > 0 ? theme.colors.onBackground : theme.colors.outline,
                lineHeight: 24,
              }}
            >
              {bedLabel}
            </Text>
            {isOwner ? (
              <Button
                mode="text"
                compact
                icon="pencil-outline"
                onPress={startBedsEdit}
                style={{ alignSelf: 'flex-start', marginTop: 4, marginLeft: -8 }}
              >
                {s + d > 0 ? 'Modifier' : 'Définir'}
              </Button>
            ) : null}
          </View>
        )}

        {!isOwner ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline, marginTop: 24, lineHeight: 18 }}
          >
            Seul un propriétaire peut modifier ces infos.
          </Text>
        ) : null}

        {saved ? (
          <Text style={{ color: theme.colors.primary, marginTop: 20 }}>{saved}</Text>
        ) : null}
        {error ? (
          <Text style={{ color: theme.colors.error, marginTop: 20 }}>{error}</Text>
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
    marginBottom: 8,
  },
  block: {
    gap: 0,
  },
  form: {
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
