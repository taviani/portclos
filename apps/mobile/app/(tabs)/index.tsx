import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchHealth } from '@/lib/api';

export default function HomeScreen() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ping = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await fetchHealth();
      setStatus(health.status);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portclos</Text>
      <Text style={styles.sub}>Maison partagée — agenda, checklists, todos, photos.</Text>
      <Pressable style={styles.button} onPress={ping} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ping API</Text>}
      </Pressable>
      {status ? <Text style={styles.ok}>API: {status}</Text> : null}
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
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  sub: {
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
  },
  button: {
    marginTop: 28,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  ok: {
    marginTop: 16,
    color: '#1e6b3a',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
    textAlign: 'center',
  },
});
