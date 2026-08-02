import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Button,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

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
import { useAppTheme } from '@/theme/paper';

export default function MeScreen() {
  const theme = useAppTheme();
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
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text
        variant="headlineMedium"
        style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.4 }}
      >
        Compte
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
      >
        {email ?? '…'}
      </Text>
      <Button
        mode="text"
        icon="logout"
        onPress={() => void signOut()}
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
        textColor={theme.colors.error}
      >
        Se déconnecter
      </Button>

      <Text
        variant="labelLarge"
        style={{
          marginTop: 28,
          marginBottom: 8,
          color: theme.colors.onSurfaceVariant,
          letterSpacing: 0.6,
        }}
      >
        MAISONS
      </Text>
      {houses.isLoading ? (
        <ActivityIndicator animating color={theme.colors.primary} />
      ) : (houses.data?.length ?? 0) === 0 ? (
        <Text style={{ color: theme.colors.outline }}>Aucune maison — crée la première.</Text>
      ) : (
        houses.data!.map((h) => {
          const active = h.id === currentHouseId.data;
          return (
            <List.Item
              key={h.id}
              title={h.name}
              description={h.role}
              onPress={() => void onSelectHouse(h.id)}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={active ? 'home' : 'home-outline'}
                  color={active ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
              )}
              right={
                active
                  ? (props) => <List.Icon {...props} icon="check" color={theme.colors.primary} />
                  : undefined
              }
              style={{
                backgroundColor: active
                  ? theme.colors.primaryContainer
                  : theme.colors.elevation.level1,
                borderRadius: theme.roundness,
                marginBottom: 8,
              }}
              titleStyle={{
                fontWeight: '700',
                color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
              }}
            />
          );
        })
      )}

      <TextInput
        mode="outlined"
        label="Nom de la maison"
        value={newHouse}
        onChangeText={setNewHouse}
        style={{ marginTop: 12, backgroundColor: theme.colors.surface }}
      />
      <Button
        mode="contained"
        icon="plus"
        onPress={() => void onCreateHouse()}
        disabled={mutating || !newHouse.trim()}
        loading={createHouse.isPending}
        style={{ marginTop: 14, borderRadius: 14 }}
        contentStyle={{ minHeight: 48 }}
      >
        Créer une maison
      </Button>
      {error || queryError ? (
        <Text style={{ color: theme.colors.error, marginTop: 14 }}>{error || queryError}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
