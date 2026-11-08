import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  List,
  Text,
} from 'react-native-paper';

import {
  useCancelClosing,
  useClosings,
  useDeleteClosing,
  useStartClosing,
} from '@/hooks/useClosing';
import { useCurrentHouse, useMe } from '@/hooks/useHouses';
import { monthKey, useOccupations } from '@/hooks/useOccupations';
import { fermetureState, isUserPresentToday } from '@/lib/fermetureState';
import { useAppTheme } from '@/theme/paper';

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const me = useMe();
  const { house, isLoading } = useCurrentHouse();
  const month = useMemo(() => monthKey(new Date()), []);
  const occupations = useOccupations(house?.id, month);
  const closings = useClosings(house?.id);
  const start = useStartClosing(house?.id);

  const todayHeadcount = useMemo(() => {
    const today = todayKey();
    const load = (occupations.data?.day_loads ?? []).find((d) => d.day === today);
    return load?.headcount ?? 0;
  }, [occupations.data?.day_loads]);

  const state = useMemo(
    () =>
      fermetureState({
        closings: closings.data,
        todayHeadcount,
        iAmPresent: isUserPresentToday(occupations.data?.occupations, me.data?.sub),
      }),
    [closings.data, todayHeadcount, occupations.data?.occupations, me.data?.sub],
  );

  const openClosing = (closings.data ?? []).find((c) => c.status === 'open');
  const cancel = useCancelClosing(openClosing?.id, house?.id);
  const removeClosing = useDeleteClosing(house?.id);

  if (isLoading || closings.isLoading || occupations.isLoading) {
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

  const history = (closings.data ?? []).filter(
    (c) => c.status === 'completed' || c.status === 'cancelled',
  );

  const confirmCancelOpen = () => {
    if (!openClosing) return;
    Alert.alert(
      'Annuler cette fermeture ?',
      'La checklist en cours sera abandonnée. Tu pourras en recommencer une après.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            void cancel.mutateAsync().catch(() => {
              /* error surfaced via cancel.error below */
            });
          },
        },
      ],
    );
  };

  const confirmDelete = (closingId: string, label: string) => {
    Alert.alert('Supprimer cette fermeture ?', `${label} sera retirée de l’historique.`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void removeClosing.mutateAsync(closingId).catch(() => {
            /* surfaced via removeClosing.error */
          });
        },
      },
    ]);
  };

  const beginOrResume = () => {
    if (openClosing) {
      router.push(`/(tabs)/maison/fermeture/${openClosing.id}`);
      return;
    }
    if (!state.canStart) return;
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

  const cardTitle =
    state.kind === 'en_cours'
      ? 'Fermeture en cours'
      : state.kind === 'ouverte'
        ? 'Maison ouverte'
        : 'Maison fermée';

  const cardBody =
    state.kind === 'en_cours' && openClosing
      ? `Commencée ${formatWhen(openClosing.started_at)}`
      : state.kind === 'ouverte' && state.canStart
        ? 'Tu es présent : tu peux lancer la checklist.'
        : state.kind === 'ouverte'
          ? 'Tu dois être présent pour lancer une fermeture.'
          : 'Aucune présence aujourd’hui. Une présence rouvre la maison.';

  const startErrorMsg = (() => {
    const msg = start.error instanceof Error ? start.error.message : '';
    if (msg.includes('not_present')) {
      return 'Tu dois être présent pour lancer une fermeture.';
    }
    if (msg) return msg;
    if (cancel.error instanceof Error) return cancel.error.message;
    return null;
  })();

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
        Passe la checklist. Les infos de chaque étape sont dans le détail.
      </Text>

      <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
        <Card.Content style={{ paddingVertical: 8 }}>
          <Text
            variant="titleLarge"
            style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
          >
            {cardTitle}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onPrimaryContainer, opacity: 0.85, marginTop: 6 }}
          >
            {cardBody}
          </Text>
        </Card.Content>
        <Card.Actions
          style={{
            paddingBottom: 12,
            paddingHorizontal: 12,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 4,
          }}
        >
          {state.kind === 'en_cours' || state.canStart ? (
            <Button
              mode="contained"
              icon={state.kind === 'en_cours' ? 'play' : 'play-circle'}
              loading={start.isPending}
              disabled={cancel.isPending || (state.kind !== 'en_cours' && !state.canStart)}
              onPress={beginOrResume}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              contentStyle={{ minHeight: 48 }}
              style={{ borderRadius: 14 }}
            >
              {state.kind === 'en_cours' ? 'Reprendre' : 'Commencer'}
            </Button>
          ) : null}
          {state.kind === 'en_cours' ? (
            <Button
              mode="text"
              icon="close-circle-outline"
              loading={cancel.isPending}
              disabled={start.isPending || cancel.isPending}
              onPress={confirmCancelOpen}
              textColor={theme.colors.error}
            >
              Annuler la fermeture
            </Button>
          ) : null}
        </Card.Actions>
      </Card>

      {startErrorMsg ? (
        <Text style={{ color: theme.colors.error, marginTop: 12 }}>{startErrorMsg}</Text>
      ) : null}
      {removeClosing.error ? (
        <Text style={{ color: theme.colors.error, marginTop: 12 }}>
          {removeClosing.error instanceof Error
            ? removeClosing.error.message
            : 'Suppression impossible'}
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
        HISTORIQUE
      </Text>
      {history.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
          Pas encore de fermeture enregistrée.
        </Text>
      ) : (
        history.map((c) => {
          const title = c.status === 'completed' ? 'Terminée' : 'Annulée';
          return (
            <List.Item
              key={c.id}
              title={title}
              description={formatWhen(c.completed_at ?? c.started_at)}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={c.status === 'completed' ? 'check-circle' : 'close-circle-outline'}
                  color={
                    c.status === 'completed' ? theme.colors.primary : theme.colors.outline
                  }
                />
              )}
              right={() => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    accessibilityLabel="Supprimer"
                    disabled={removeClosing.isPending}
                    onPress={() => confirmDelete(c.id, title)}
                  />
                  <List.Icon icon="chevron-right" color={theme.colors.outline} />
                </View>
              )}
              onPress={() => router.push(`/(tabs)/maison/fermeture/${c.id}`)}
              style={{
                backgroundColor: theme.colors.elevation.level1,
                borderRadius: theme.roundness,
                marginTop: 8,
              }}
            />
          );
        })
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
});
