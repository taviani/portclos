import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useSession } from '@/providers/SessionProvider';

export default function HomeScreen() {
  const { token, ready } = useSession();
  const { house, isLoading, error } = useCurrentHouse();

  if (!ready || (token && isLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portclos</Text>
      {!token || !house ? (
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
      {error ? <Text style={styles.err}>{error.message}</Text> : null}
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
