import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Text, View, useThemeColor } from '@/components/Themed';
import {
  useCreateHouse,
  useCurrentHouseId,
  useHouses,
  useMe,
  useSelectHouse,
} from '@/hooks/useHouses';
import { setCurrentHouseId } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export default function MeScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');

  const { token, ready, signOut } = useSession();
  const qc = useQueryClient();
  const me = useMe();
  const houses = useHouses();
  const currentHouseId = useCurrentHouseId();
  const createHouse = useCreateHouse();
  const selectHouse = useSelectHouse();

  const [newHouse, setNewHouse] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !houses.data?.length || currentHouseId.data) {
      return;
    }
    const first = houses.data[0];
    void (async () => {
      await setCurrentHouseId(first.id);
      await qc.invalidateQueries({ queryKey: queryKeys.currentHouseId });
    })();
  }, [token, houses.data, currentHouseId.data, qc]);

  const onCreateHouse = useCallback(async () => {
    if (!newHouse.trim()) return;
    setError(null);
    try {
      await createHouse.mutateAsync(newHouse.trim());
      setNewHouse('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create failed');
    }
  }, [newHouse, createHouse]);

  const onSelectHouse = useCallback(
    async (id: string) => {
      try {
        await selectHouse.mutateAsync(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'select failed');
      }
    },
    [selectHouse],
  );

  const email = me.data?.email || me.data?.sub || null;
  const mutating = createHouse.isPending || selectHouse.isPending;
  const queryError =
    (me.error instanceof Error && me.error.message) ||
    (houses.error instanceof Error && houses.error.message) ||
    null;

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compte</Text>
      <Text style={styles.sub}>{email ?? '…'}</Text>
      <Pressable style={styles.secondary} onPress={() => void signOut()}>
        <Text style={styles.secondaryText}>Se déconnecter</Text>
      </Pressable>

      <Text style={styles.section}>Maisons</Text>
      {houses.isLoading ? (
        <ActivityIndicator />
      ) : (houses.data?.length ?? 0) === 0 ? (
        <Text style={styles.hint}>Aucune maison — crée la première.</Text>
      ) : (
        houses.data!.map((h) => {
          const active = h.id === currentHouseId.data;
          return (
            <Pressable
              key={h.id}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => void onSelectHouse(h.id)}
            >
              <Text style={active ? styles.rowTextActive : undefined}>
                {h.name} ({h.role})
              </Text>
            </Pressable>
          );
        })
      )}

      <TextInput
        style={[
          styles.input,
          {
            color: inputColor,
            borderColor: inputBorder,
            backgroundColor: inputBg,
          },
        ]}
        placeholder="Nom de la maison"
        placeholderTextColor={placeholderColor}
        value={newHouse}
        onChangeText={setNewHouse}
        keyboardAppearance="default"
      />
      <Pressable
        style={[styles.button, mutating && styles.disabled]}
        onPress={() => void onCreateHouse()}
        disabled={mutating || !newHouse.trim()}
      >
        <Text style={styles.buttonText}>Créer une maison</Text>
      </Pressable>
      {error || queryError ? <Text style={styles.err}>{error || queryError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  sub: {
    marginTop: 12,
    opacity: 0.7,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    marginTop: 8,
    opacity: 0.55,
    fontSize: 12,
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
  secondary: {
    marginTop: 12,
  },
  secondaryText: {
    opacity: 0.7,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowActive: {
    backgroundColor: '#1a1612',
  },
  rowTextActive: {
    color: '#fff',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
  },
});
