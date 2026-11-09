import { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Redirect, useNavigation } from 'expo-router';
import {
  ActivityIndicator,
  Button,
  Divider,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import { KeyboardScreen } from '@/components/KeyboardScreen';
import {
  useCreateHouseInvite,
  useHouseInvites,
  useRevokeHouseInvite,
} from '@/hooks/useHouseInvites';
import { useCurrentHouse, useHouseMembers } from '@/hooks/useHouses';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

function inviteErrorLabel(raw: string): string {
  switch (raw) {
    case 'invalid_email':
      return 'Adresse e-mail invalide';
    case 'already_member':
      return 'Cette personne est déjà membre de la maison';
    case 'invite_pending':
      return 'Une invitation est déjà en attente pour cet e-mail';
    case 'forbidden':
      return 'Tu dois être membre de la maison pour inviter';
    case 'mail_failed':
      return 'Invitation créée, mais l’envoi du mail a échoué';
    default:
      return raw;
  }
}

export default function InviterScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { token, ready } = useSession();
  const { house, isLoading: houseLoading } = useCurrentHouse();
  const invites = useHouseInvites(house?.id);
  const members = useHouseMembers(house?.id);
  const createInvite = useCreateHouseInvite(house?.id);
  const revokeInvite = useRevokeHouseInvite(house?.id);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: house ? `Inviter · ${house.name}` : 'Inviter',
    });
  }, [navigation, house]);

  const onInvite = useCallback(async () => {
    setError(null);
    setOkMsg(null);
    try {
      await createInvite.mutateAsync(email.trim());
      setEmail('');
      setOkMsg('Invitation envoyée.');
    } catch (e) {
      setError(inviteErrorLabel(e instanceof Error ? e.message : 'envoi impossible'));
    }
  }, [createInvite, email]);

  const onRevoke = useCallback(
    (inviteId: string, inviteEmail: string) => {
      Alert.alert('Révoquer l’invitation ?', inviteEmail, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: () => {
            void revokeInvite.mutateAsync(inviteId).catch((e) => {
              setError(inviteErrorLabel(e instanceof Error ? e.message : 'échec'));
            });
          },
        },
      ]);
    },
    [revokeInvite],
  );

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

  if (houseLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          Choisis d’abord une maison dans Compte.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardScreen
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22, marginBottom: 12 }}
      >
        Invite une personne à rejoindre l’indivision de « {house.name} ».
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22, marginBottom: 12 }}
      >
        La personne recevra un lien par e-mail. Pour rejoindre la maison, elle devra
        ouvrir ce lien et se connecter avec l’adresse e-mail invitée.
      </Text>

      <TextInput
        mode="outlined"
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        style={styles.field}
      />
      <Button
        mode="contained"
        icon="email-plus-outline"
        onPress={() => void onInvite()}
        loading={createInvite.isPending}
        disabled={!email.trim() || createInvite.isPending}
        style={styles.cta}
        contentStyle={styles.ctaContent}
      >
        Envoyer l’invitation
      </Button>

      {okMsg ? (
        <Text style={{ color: theme.colors.primary, marginTop: 12 }}>{okMsg}</Text>
      ) : null}
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 12 }}>{error}</Text>
      ) : null}

      <Divider style={styles.divider} />

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 4 }}>
        Invitations en attente
      </Text>
      {invites.isLoading ? (
        <ActivityIndicator animating color={theme.colors.primary} />
      ) : (invites.data ?? []).length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Aucune invitation en attente.
        </Text>
      ) : (
        (invites.data ?? []).map((inv) => (
          <List.Item
            key={inv.id}
            title={inv.email}
            description="En attente"
            right={() => (
              <Button compact onPress={() => onRevoke(inv.id, inv.email)}>
                Révoquer
              </Button>
            )}
            style={styles.listRow}
          />
        ))
      )}

      <Divider style={styles.divider} />

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 4 }}>
        Membres
      </Text>
      {members.isLoading ? (
        <ActivityIndicator animating color={theme.colors.primary} />
      ) : (
        (members.data ?? []).map((m) => {
          const label = m.display_name?.trim() || m.email || m.user_sub;
          const joinedAt = m.joined_at ? new Date(m.joined_at) : null;
          const joinedLabel = joinedAt && !Number.isNaN(joinedAt.getTime())
            ? `Membre depuis le ${joinedAt.toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}`
            : undefined;
          return (
            <List.Item
              key={m.user_sub}
              title={label}
              description={joinedLabel}
              style={styles.listRow}
            />
          );
        })
      )}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  cta: {
    borderRadius: 12,
  },
  ctaContent: {
    minHeight: 48,
  },
  divider: {
    marginVertical: 22,
  },
  listRow: {
    marginHorizontal: -8,
    borderRadius: 10,
  },
});
