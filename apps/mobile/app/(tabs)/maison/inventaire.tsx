import { useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  useCreateInventoryItem,
  useDeleteInventoryItem,
  useInventory,
  useUpdateInventoryItem,
} from '@/hooks/useInventory';
import { useCurrentHouse } from '@/hooks/useHouses';
import type { InventoryItem, InventoryKind } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

export default function InventaireScreen() {
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const items = useInventory(house?.id);
  const createItem = useCreateInventoryItem(house?.id);
  const updateItem = useUpdateInventoryItem(house?.id);
  const deleteItem = useDeleteInventoryItem(house?.id);

  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<InventoryKind>('needed');
  const [priority, setPriority] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stock = useMemo(
    () => (items.data ?? []).filter((it) => it.kind === 'stock'),
    [items.data],
  );
  const needed = useMemo(
    () => (items.data ?? []).filter((it) => it.kind === 'needed'),
    [items.data],
  );

  const onAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    void createItem
      .mutateAsync({
        label: trimmed,
        kind,
        priority: kind === 'needed' ? priority : false,
      })
      .then(() => {
        setLabel('');
        setPriority(kind === 'needed');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'ajout impossible'));
  };

  const onTogglePriority = (it: InventoryItem) => {
    if (it.kind !== 'needed') return;
    void updateItem
      .mutateAsync({
        itemId: it.id,
        label: it.label,
        kind: 'needed',
        priority: !it.priority,
        note: it.note,
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'mise à jour impossible'));
  };

  const onMoveKind = (it: InventoryItem) => {
    const nextKind: InventoryKind = it.kind === 'stock' ? 'needed' : 'stock';
    void updateItem
      .mutateAsync({
        itemId: it.id,
        label: it.label,
        kind: nextKind,
        priority: nextKind === 'needed',
        note: it.note,
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'mise à jour impossible'));
  };

  const onDelete = (it: InventoryItem) => {
    Alert.alert('Supprimer', `Retirer « ${it.label} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void deleteItem
            .mutateAsync(it.id)
            .catch((e) => setError(e instanceof Error ? e.message : 'suppression impossible'));
        },
      },
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
          Ce qu’il y a dans la maison, et ce qu’il faut acheter ou renouveler en priorité.
        </Text>

        <View style={styles.addBlock}>
          <TextInput
            mode="outlined"
            label="Nouvel élément"
            value={label}
            onChangeText={setLabel}
            style={{ backgroundColor: theme.colors.surface }}
          />
          <View style={styles.kindRow}>
            <Chip
              selected={kind === 'stock'}
              onPress={() => {
                setKind('stock');
                setPriority(false);
              }}
              style={{ marginRight: 8 }}
            >
              Présent
            </Chip>
            <Chip
              selected={kind === 'needed'}
              onPress={() => {
                setKind('needed');
                setPriority(true);
              }}
            >
              À acheter
            </Chip>
          </View>
          {kind === 'needed' ? (
            <View style={styles.switchRow}>
              <Text style={{ color: theme.colors.onSurface, flex: 1 }}>Priorité</Text>
              <Switch value={priority} onValueChange={setPriority} color={theme.colors.primary} />
            </View>
          ) : null}
          <Button
            mode="contained"
            icon="plus"
            disabled={!label.trim() || createItem.isPending}
            loading={createItem.isPending}
            onPress={onAdd}
            style={{ marginTop: 12, borderRadius: 14 }}
            contentStyle={{ minHeight: 48 }}
          >
            Ajouter
          </Button>
        </View>

        {error ? (
          <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
        ) : null}

        <SectionTitle themeColor={theme.colors.onSurfaceVariant}>Dans la maison</SectionTitle>
        {stock.length === 0 ? (
          <Text style={{ color: theme.colors.outline, marginBottom: 18 }}>
            Aucun élément listé pour l’instant.
          </Text>
        ) : (
          stock.map((it) => (
            <InventoryRow
              key={it.id}
              item={it}
              onDelete={() => onDelete(it)}
              onMove={() => onMoveKind(it)}
              moveLabel="À acheter"
            />
          ))
        )}

        <SectionTitle themeColor={theme.colors.onSurfaceVariant}>
          À acheter ou renouveler
        </SectionTitle>
        {needed.length === 0 ? (
          <Text style={{ color: theme.colors.outline, marginBottom: 18 }}>
            Rien à prévoir pour le moment.
          </Text>
        ) : (
          needed.map((it) => (
            <InventoryRow
              key={it.id}
              item={it}
              onDelete={() => onDelete(it)}
              onMove={() => onMoveKind(it)}
              onTogglePriority={() => onTogglePriority(it)}
              moveLabel="Présent"
            />
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({
  children,
  themeColor,
}: {
  children: string;
  themeColor: string;
}) {
  return (
    <Text
      variant="titleMedium"
      style={{ fontWeight: '700', color: themeColor, marginTop: 8, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
}

function InventoryRow({
  item,
  onDelete,
  onMove,
  onTogglePriority,
  moveLabel,
}: {
  item: InventoryItem;
  onDelete: () => void;
  onMove: () => void;
  onTogglePriority?: () => void;
  moveLabel: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.colors.elevation.level1, borderRadius: theme.roundness },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.onSurface, fontWeight: '600', fontSize: 16 }}>
          {item.label}
        </Text>
        {item.kind === 'needed' && item.priority ? (
          <Text style={{ color: theme.colors.primary, marginTop: 2, fontSize: 13 }}>
            Priorité
          </Text>
        ) : null}
      </View>
      {onTogglePriority ? (
        <IconButton
          icon={item.priority ? 'flag' : 'flag-outline'}
          iconColor={item.priority ? theme.colors.primary : theme.colors.outline}
          onPress={onTogglePriority}
          accessibilityLabel="Basculer priorité"
        />
      ) : null}
      <Button compact onPress={onMove}>
        {moveLabel}
      </Button>
      <IconButton
        icon="trash-can-outline"
        iconColor={theme.colors.error}
        onPress={onDelete}
        accessibilityLabel="Supprimer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addBlock: { marginBottom: 20 },
  kindRow: { flexDirection: 'row', marginTop: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
});
