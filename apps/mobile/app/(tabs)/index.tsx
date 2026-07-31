import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchHouses, House } from '@/lib/api';
import { getAccessToken, getCurrentHouseId } from '@/lib/auth';

export default function HomeScreen() {
  const [house, setHouse] = useState<House | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setHouse(null);
        return;
      }
      const list = await fetchHouses(token);
      const currentId = await getCurrentHouseId();
      const current =
        list.find((h) => h.id === currentId) ?? (list.length > 0 ? list[0] : null);
      setHouse(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setHouse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portclos</Text>
      {!house ? (
        <Text style={styles.sub}>
          Connecte-toi et choisis / crée une maison dans l’onglet Compte.
        </Text>
      ) : (
        <>
          <Text style={styles.house}>{house.name}</Text>
          <Text style={styles.sub}>
            Maison courante ({house.role}). Agenda, checklists, todos — à venir.
          </Text>
        </>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  house: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
  },
  sub: {
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
    textAlign: 'center',
  },
});
