import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';
import { useClosings, useStartClosing } from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FermetureHomeScreen() {
  const surface = useThemeColor({ light: Brand.surface, dark: '#1c1c1e' }, 'background');
  const line = useThemeColor({ light: Brand.line, dark: '#333' }, 'text');

  const { house, isLoading } = useCurrentHouse();
  const closings = useClosings(house?.id);
  const start = useStartClosing(house?.id);

  if (isLoading || closings.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.ink} />
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

  const beginOrResume = () => {
    if (open) {
      router.push(`/(tabs)/maison/fermeture/${open.id}`);
      return;
    }
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
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Avant de partir</Text>
      <Text style={styles.lead}>
        Passe la checklist. Les photos du modèle montrent où agir.
      </Text>

      <View style={[styles.hero, { backgroundColor: surface }]}>
        {open ? (
          <>
            <Text style={styles.heroLabel}>Fermeture en cours</Text>
            <Text style={styles.heroMeta}>Commencée {formatWhen(open.started_at)}</Text>
            <PrimaryButton
              label="Reprendre"
              onPress={beginOrResume}
              style={styles.heroBtn}
            />
          </>
        ) : (
          <>
            <Text style={styles.heroLabel}>Prêt à fermer ?</Text>
            <Text style={styles.heroMeta}>Une checklist claire, étape par étape.</Text>
            <PrimaryButton
              label="Commencer"
              onPress={beginOrResume}
              busy={start.isPending}
              style={styles.heroBtn}
            />
          </>
        )}
      </View>

      <PrimaryButton
        variant="ghost"
        label="Modifier le modèle"
        onPress={() => router.push('/(tabs)/maison/fermeture/modele')}
        style={styles.modelBtn}
      />

      {start.error ? (
        <Text style={styles.err}>
          {start.error instanceof Error ? start.error.message : 'Erreur'}
        </Text>
      ) : null}

      <Text style={styles.section}>Récentes</Text>
      {recent.length === 0 ? (
        <Text style={styles.hint}>Pas encore de fermeture terminée.</Text>
      ) : (
        recent.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/(tabs)/maison/fermeture/${c.id}`)}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: line, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View>
              <Text style={styles.rowTitle}>Terminée</Text>
              <Text style={styles.rowMeta}>{formatWhen(c.completed_at ?? c.started_at)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lead: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.62,
  },
  hero: {
    borderRadius: 20,
    padding: 20,
  },
  heroLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroMeta: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.55,
    lineHeight: 20,
  },
  heroBtn: {
    marginTop: 18,
  },
  modelBtn: {
    marginTop: 12,
  },
  section: {
    marginTop: 36,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  hint: {
    marginTop: 10,
    opacity: 0.5,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 13,
    opacity: 0.5,
  },
  chevron: {
    opacity: 0.3,
    fontSize: 22,
  },
  sub: {
    opacity: 0.7,
  },
  err: {
    marginTop: 12,
    color: Brand.danger,
  },
});
