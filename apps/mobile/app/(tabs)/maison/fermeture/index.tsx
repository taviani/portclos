import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useClosings, useStartClosing } from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';

export default function FermetureHomeScreen() {
  const { house, isLoading } = useCurrentHouse();
  const closings = useClosings(house?.id);
  const start = useStartClosing(house?.id);

  if (isLoading || closings.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.container}>
        <Text style={styles.sub}>Choisis une maison dans Compte.</Text>
      </View>
    );
  }

  const open = (closings.data ?? []).find((c) => c.status === 'open');
  const recent = (closings.data ?? []).filter((c) => c.status === 'completed').slice(0, 8);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        Checklist de départ : tâches requises et optionnelles, avec photos si besoin.
      </Text>

      {open ? (
        <Pressable
          style={styles.button}
          onPress={() => router.push(`/(tabs)/maison/fermeture/${open.id}`)}
        >
          <Text style={styles.buttonText}>Reprendre la fermeture en cours</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, start.isPending && styles.disabled]}
          disabled={start.isPending}
          onPress={() => {
            void start
              .mutateAsync()
              .then((detail) => router.push(`/(tabs)/maison/fermeture/${detail.id}`))
              .catch((e) => {
                const msg = e instanceof Error ? e.message : '';
                if (msg.includes('closing_already_open') || msg.includes('409')) {
                  void closings.refetch().then((res) => {
                    const again = res.data?.find((c) => c.status === 'open');
                    if (again) router.push(`/(tabs)/maison/fermeture/${again.id}`);
                  });
                }
              });
          }}
        >
          <Text style={styles.buttonText}>
            {start.isPending ? '…' : 'Commencer une fermeture'}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={styles.secondary}
        onPress={() => router.push('/(tabs)/maison/fermeture/modele')}
      >
        <Text style={styles.secondaryText}>Modifier le modèle de checklist</Text>
      </Pressable>

      {start.error ? (
        <Text style={styles.err}>
          {start.error instanceof Error ? start.error.message : 'Erreur'}
        </Text>
      ) : null}

      <Text style={styles.section}>Fermetures récentes</Text>
      {recent.length === 0 ? (
        <Text style={styles.hint}>Aucune fermeture terminée pour l’instant.</Text>
      ) : (
        recent.map((c) => (
          <Pressable
            key={c.id}
            style={styles.row}
            onPress={() => router.push(`/(tabs)/maison/fermeture/${c.id}`)}
          >
            <Text>
              {new Date(c.completed_at ?? c.started_at).toLocaleString('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  button: {
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  secondary: {
    marginTop: 16,
  },
  secondaryText: {
    opacity: 0.7,
  },
  section: {
    marginTop: 32,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    opacity: 0.55,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  chevron: {
    opacity: 0.35,
    fontSize: 20,
  },
  sub: {
    opacity: 0.7,
  },
  err: {
    marginTop: 12,
    color: '#9b1c1c',
  },
});
