import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Button,
  Card,
  List,
  Text,
} from 'react-native-paper';

import { useClosings, useStartClosing } from '@/hooks/useClosing';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useAppTheme } from '@/theme/paper';

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
  const theme = useAppTheme();
  const { house, isLoading } = useCurrentHouse();
  const closings = useClosings(house?.id);
  const start = useStartClosing(house?.id);

  if (isLoading || closings.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          Choisis une maison dans Compte.
        </Text>
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
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text
        variant="headlineMedium"
        style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.4 }}
      >
        Avant de partir
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 20, lineHeight: 24 }}
      >
        Passe la checklist. Les photos du modèle montrent où agir.
      </Text>

      <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
        <Card.Content style={{ paddingVertical: 8 }}>
          <Text
            variant="titleLarge"
            style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
          >
            {open ? 'Fermeture en cours' : 'Prêt à fermer ?'}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onPrimaryContainer, opacity: 0.85, marginTop: 6 }}
          >
            {open
              ? `Commencée ${formatWhen(open.started_at)}`
              : 'Une checklist claire, étape par étape.'}
          </Text>
        </Card.Content>
        <Card.Actions style={{ paddingBottom: 12, paddingHorizontal: 12 }}>
          <Button
            mode="contained"
            icon={open ? 'play' : 'play-circle'}
            loading={start.isPending}
            onPress={beginOrResume}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
            contentStyle={{ minHeight: 48 }}
            style={{ borderRadius: 14, flex: 1 }}
          >
            {open ? 'Reprendre' : 'Commencer'}
          </Button>
        </Card.Actions>
      </Card>

      <Button
        mode="outlined"
        icon="pencil-outline"
        onPress={() => router.push('/(tabs)/maison/fermeture/modele')}
        style={styles.modelBtn}
        contentStyle={{ minHeight: 48 }}
      >
        Modifier le modèle
      </Button>

      {start.error ? (
        <Text style={{ color: theme.colors.error, marginTop: 12 }}>
          {start.error instanceof Error ? start.error.message : 'Erreur'}
        </Text>
      ) : null}

      <Text
        variant="labelLarge"
        style={{
          marginTop: 32,
          marginBottom: 4,
          color: theme.colors.onSurfaceVariant,
          letterSpacing: 0.6,
        }}
      >
        RÉCENTES
      </Text>
      {recent.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
          Pas encore de fermeture terminée.
        </Text>
      ) : (
        recent.map((c) => (
          <List.Item
            key={c.id}
            title="Terminée"
            description={formatWhen(c.completed_at ?? c.started_at)}
            left={(props) => <List.Icon {...props} icon="check-circle" color={theme.colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push(`/(tabs)/maison/fermeture/${c.id}`)}
            style={{
              backgroundColor: theme.colors.elevation.level1,
              borderRadius: theme.roundness,
              marginTop: 8,
            }}
          />
        ))
      )}
    </ScrollView>
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
  modelBtn: {
    marginTop: 12,
    borderRadius: 14,
  },
});
