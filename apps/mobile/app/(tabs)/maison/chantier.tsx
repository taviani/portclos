import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  useChantiers,
  useCreateChantier,
  useDeleteChantier,
  useUpdateChantier,
} from '@/hooks/useChantier';
import { useCurrentHouse } from '@/hooks/useHouses';
import {
  CHANTIER_STATUS_LABELS,
  type Chantier,
  type ChantierStatus,
} from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

const STATUSES: ChantierStatus[] = ['planned', 'in_progress', 'done'];

export default function ChantierScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const list = useChantiers(house?.id);
  const create = useCreateChantier(house?.id);
  const update = useUpdateChantier(house?.id);
  const remove = useDeleteChantier(house?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    void create
      .mutateAsync({
        title: trimmed,
        description: description.trim() || undefined,
        status: 'planned',
      })
      .then(() => {
        setTitle('');
        setDescription('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'création impossible'));
  };

  const onSetStatus = (c: Chantier, status: ChantierStatus) => {
    void update
      .mutateAsync({
        chantierId: c.id,
        title: c.title,
        description: c.description,
        status,
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'mise à jour impossible'));
  };

  const onDelete = (c: Chantier) => {
    Alert.alert('Supprimer', `Retirer « ${c.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void remove
            .mutateAsync(c.id)
            .catch((e) => setError(e instanceof Error ? e.message : 'suppression impossible'));
        },
      },
    ]);
  };

  if (isLoading || list.isLoading) {
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16, lineHeight: 24 }}
        >
          Travaux, réparations et projets en cours ou à prévoir.
        </Text>

        <TextInput
          mode="outlined"
          label="Nouveau chantier"
          value={title}
          onChangeText={setTitle}
          style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
        />
        <TextInput
          mode="outlined"
          label="Description (optionnel)"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ backgroundColor: theme.colors.surface }}
        />
        <Button
          mode="contained"
          icon="plus"
          disabled={!title.trim() || create.isPending}
          loading={create.isPending}
          onPress={onAdd}
          style={{ marginTop: 12, marginBottom: 20, borderRadius: 14 }}
          contentStyle={{ minHeight: 48 }}
        >
          Ajouter
        </Button>

        {error ? (
          <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
        ) : null}

        {(list.data ?? []).length === 0 ? (
          <Text style={{ color: theme.colors.outline }}>Aucun chantier pour le moment.</Text>
        ) : (
          (list.data ?? []).map((c) => (
            <View
              key={c.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderRadius: theme.roundness,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.onSurface,
                      fontWeight: '700',
                      fontSize: 17,
                    }}
                  >
                    {c.title}
                  </Text>
                  {c.description ? (
                    <Text
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 4,
                        lineHeight: 20,
                      }}
                    >
                      {c.description}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="trash-can-outline"
                  iconColor={theme.colors.error}
                  onPress={() => onDelete(c)}
                  accessibilityLabel="Supprimer"
                />
              </View>
              <View style={styles.statusRow}>
                {STATUSES.map((status) => (
                  <Chip
                    key={status}
                    selected={c.status === status}
                    onPress={() => onSetStatus(c, status)}
                    style={{ marginRight: 8, marginTop: 8 }}
                    compact
                  >
                    {CHANTIER_STATUS_LABELS[status] ?? status}
                  </Chip>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
