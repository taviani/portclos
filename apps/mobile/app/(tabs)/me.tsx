import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Divider,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import {
  useCreateHouse,
  useCurrentHouseId,
  useHouses,
  useMe,
  useSelectHouse,
} from '@/hooks/useHouses';
import {
  useChangePassword,
  useDeleteAvatar,
  useUpdateDisplayName,
  useUploadAvatar,
} from '@/hooks/useProfile';
import { avatarUrl } from '@/lib/api';
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
  const updateName = useUpdateDisplayName();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useDeleteAvatar();
  const changePassword = useChangePassword();

  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newHouse, setNewHouse] = useState('');
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);

  useEffect(() => {
    if (me.data) {
      setDisplayName(me.data.display_name || '');
    }
  }, [me.data]);

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

  const onSaveName = useCallback(async () => {
    setError(null);
    try {
      await updateName.mutateAsync(displayName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'enregistrement impossible');
    }
  }, [displayName, updateName]);

  const pickAvatar = useCallback(() => {
    setError(null);
    Alert.alert('Avatar', undefined, [
      {
        text: 'Photothèque',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              setError('Autorise l’accès à la photothèque.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.7,
              allowsEditing: true,
              aspect: [1, 1],
            });
            if (!result.canceled && result.assets[0]) {
              try {
                await uploadAvatar.mutateAsync({
                  uri: result.assets[0].uri,
                  mimeType: result.assets[0].mimeType,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'upload impossible');
              }
            }
          })();
        },
      },
      {
        text: 'Caméra',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              setError('Autorise l’accès à la caméra.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.7,
              allowsEditing: true,
              aspect: [1, 1],
            });
            if (!result.canceled && result.assets[0]) {
              try {
                await uploadAvatar.mutateAsync({
                  uri: result.assets[0].uri,
                  mimeType: result.assets[0].mimeType,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'upload impossible');
              }
            }
          })();
        },
      },
      ...(me.data?.has_avatar
        ? [
            {
              text: 'Supprimer',
              style: 'destructive' as const,
              onPress: () => {
                void removeAvatar.mutateAsync().catch((e) => {
                  setError(e instanceof Error ? e.message : 'suppression impossible');
                });
              },
            },
          ]
        : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }, [me.data?.has_avatar, removeAvatar, uploadAvatar]);

  const onChangePassword = useCallback(async () => {
    setError(null);
    setPasswordOk(false);
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'changement impossible');
    }
  }, [changePassword, confirmPassword, currentPassword, newPassword]);

  const onCreateHouse = useCallback(async () => {
    if (!newHouse.trim()) return;
    setError(null);
    try {
      await createHouse.mutateAsync(newHouse.trim());
      setNewHouse('');
      setShowAddHouse(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'création impossible');
    }
  }, [newHouse, createHouse]);

  const onSelectHouse = useCallback(
    async (id: string) => {
      try {
        await selectHouse.mutateAsync(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'sélection impossible');
      }
    },
    [selectHouse],
  );

  const email = me.data?.email || me.data?.sub || null;
  const queryError =
    (me.error instanceof Error && me.error.message) ||
    (houses.error instanceof Error && houses.error.message) ||
    null;
  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase();

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
      keyboardShouldPersistTaps="handled"
    >
      <Text
        variant="headlineMedium"
        style={{ color: theme.colors.onBackground, fontWeight: '800', letterSpacing: -0.4 }}
      >
        Compte
      </Text>

      <View style={styles.avatarBlock}>
        <Pressable onPress={pickAvatar} accessibilityLabel="Changer l’avatar">
          {me.data?.has_avatar && me.data.sub ? (
            <AuthedImage
              url={avatarUrl(me.data.sub)}
              cacheKey={`avatar-${me.data.sub}-${me.data.updated_at ?? ''}`}
              style={styles.avatarImg}
            />
          ) : (
            <Avatar.Text
              size={88}
              label={initial}
              style={{ backgroundColor: theme.colors.primaryContainer }}
              labelStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
            />
          )}
        </Pressable>
        <Button mode="text" compact onPress={pickAvatar} loading={uploadAvatar.isPending}>
          Modifier la photo
        </Button>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {email ?? '…'}
        </Text>
      </View>

      <Text
        variant="labelLarge"
        style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        PROFIL
      </Text>
      <TextInput
        mode="outlined"
        label="Nom d’affichage"
        value={displayName}
        onChangeText={setDisplayName}
        style={{ backgroundColor: theme.colors.surface }}
      />
      <Button
        mode="contained-tonal"
        onPress={() => void onSaveName()}
        loading={updateName.isPending}
        disabled={updateName.isPending}
        style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 12 }}
      >
        Enregistrer le nom
      </Button>

      <Text
        variant="labelLarge"
        style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, marginTop: 28 }]}
      >
        MOT DE PASSE
      </Text>
      <TextInput
        mode="outlined"
        label="Mot de passe actuel"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
      />
      <TextInput
        mode="outlined"
        label="Nouveau mot de passe"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={{ backgroundColor: theme.colors.surface, marginBottom: 8 }}
      />
      <TextInput
        mode="outlined"
        label="Confirmer"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={{ backgroundColor: theme.colors.surface }}
      />
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.outline, marginTop: 6 }}
      >
        Au moins 12 caractères.
      </Text>
      <Button
        mode="contained-tonal"
        onPress={() => void onChangePassword()}
        loading={changePassword.isPending}
        disabled={
          changePassword.isPending ||
          !currentPassword ||
          !newPassword ||
          !confirmPassword
        }
        style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 12 }}
      >
        Changer le mot de passe
      </Button>
      {passwordOk ? (
        <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
          Mot de passe mis à jour.
        </Text>
      ) : null}

      <Button
        mode="text"
        icon="logout"
        onPress={() => void signOut()}
        style={{ alignSelf: 'flex-start', marginTop: 20 }}
        textColor={theme.colors.error}
      >
        Se déconnecter
      </Button>

      <Divider style={{ marginVertical: 28 }} />

      <Text
        variant="labelLarge"
        style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        MAISON ACTIVE
      </Text>
      {houses.isLoading ? (
        <ActivityIndicator animating color={theme.colors.primary} />
      ) : (houses.data?.length ?? 0) === 0 ? (
        <Text style={{ color: theme.colors.outline }}>Aucune maison pour l’instant.</Text>
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

      {!showAddHouse ? (
        <Pressable onPress={() => setShowAddHouse(true)} style={styles.addHouseLink}>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            Ajouter une maison…
          </Text>
        </Pressable>
      ) : (
        <View style={styles.addHouseBox}>
          <TextInput
            mode="outlined"
            dense
            label="Nom"
            value={newHouse}
            onChangeText={setNewHouse}
            style={{ backgroundColor: theme.colors.surface }}
          />
          <View style={styles.addHouseActions}>
            <Button compact onPress={() => setShowAddHouse(false)}>
              Annuler
            </Button>
            <Button
              compact
              mode="text"
              onPress={() => void onCreateHouse()}
              loading={createHouse.isPending}
              disabled={!newHouse.trim() || createHouse.isPending}
            >
              Créer
            </Button>
          </View>
        </View>
      )}

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
  avatarBlock: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 4,
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  sectionLabel: {
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  addHouseLink: {
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  addHouseBox: {
    marginTop: 12,
    opacity: 0.9,
  },
  addHouseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
});
