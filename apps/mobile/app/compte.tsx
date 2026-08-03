import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, useNavigation } from 'expo-router';
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
import { MaisonHeaderActions } from '@/components/MaisonHeaderActions';
import {
  useCreateHouse,
  useCurrentHouse,
  useCurrentHouseId,
  useHouses,
  useMe,
  useSelectHouse,
  useUpdateHouse,
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

export default function CompteScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { token, ready, signOut } = useSession();
  const qc = useQueryClient();
  const me = useMe();
  const houses = useHouses();
  const currentHouseId = useCurrentHouseId();
  const createHouse = useCreateHouse();
  const selectHouse = useSelectHouse();
  const { house: activeHouse } = useCurrentHouse();
  const updateHouseFields = useUpdateHouse(activeHouse?.id);
  const updateName = useUpdateDisplayName();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useDeleteAvatar();
  const changePassword = useChangePassword();

  const [displayName, setDisplayName] = useState('');
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [singleBedsDraft, setSingleBedsDraft] = useState('');
  const [doubleBedsDraft, setDoubleBedsDraft] = useState('');
  const [showCapacityEdit, setShowCapacityEdit] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [newHouse, setNewHouse] = useState('');
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const scrollRef = useRef(null as ScrollView | null);
  const addressBlockY = useRef(0);

  const scrollAddressIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, addressBlockY.current - 24),
        animated: true,
      });
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <MaisonHeaderActions showAccount={false} />,
    });
  }, [navigation]);

  useEffect(() => {
    if (showAddressEdit) {
      const t = setTimeout(scrollAddressIntoView, 150);
      return () => clearTimeout(t);
    }
  }, [showAddressEdit, scrollAddressIntoView]);

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
      setShowNameEdit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'enregistrement impossible');
    }
  }, [displayName, updateName]);

  const closeNameEdit = useCallback(() => {
    setShowNameEdit(false);
    setDisplayName(me.data?.display_name || '');
    setError(null);
  }, [me.data?.display_name]);

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
      setShowPasswordEdit(false);
      setPasswordOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'changement impossible');
    }
  }, [changePassword, confirmPassword, currentPassword, newPassword]);

  const closePasswordEdit = useCallback(() => {
    setShowPasswordEdit(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }, []);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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

      {showNameEdit ? (
        <View>
          <TextInput
            mode="outlined"
            label="Nom d’affichage"
            value={displayName}
            onChangeText={setDisplayName}
            style={{ backgroundColor: theme.colors.surface }}
          />
          <View style={[styles.ctaRow, { marginTop: 10 }]}>
            <Button compact onPress={closeNameEdit}>
              Annuler
            </Button>
            <Button
              compact
              mode="contained-tonal"
              onPress={() => void onSaveName()}
              loading={updateName.isPending}
              disabled={updateName.isPending}
            >
              Enregistrer
            </Button>
          </View>
        </View>
      ) : (
        <Button
          mode="outlined"
          icon="account-edit-outline"
          onPress={() => {
            setDisplayName(me.data?.display_name || '');
            setShowNameEdit(true);
          }}
          style={styles.cta}
          contentStyle={styles.ctaContent}
        >
          {displayName.trim() ? 'Modifier le nom d’affichage' : 'Choisir un nom d’affichage'}
        </Button>
      )}
      {!showNameEdit && displayName.trim() ? (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {displayName.trim()}
        </Text>
      ) : null}

      {showPasswordEdit ? (
        <View>
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
          <View style={[styles.ctaRow, { marginTop: 10 }]}>
            <Button compact onPress={closePasswordEdit}>
              Annuler
            </Button>
            <Button
              compact
              mode="contained-tonal"
              onPress={() => void onChangePassword()}
              loading={changePassword.isPending}
              disabled={
                changePassword.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              Enregistrer
            </Button>
          </View>
        </View>
      ) : (
        <Button
          mode="outlined"
          icon="lock-reset"
          onPress={() => {
            setPasswordOk(false);
            setShowPasswordEdit(true);
          }}
          style={[styles.cta, { marginTop: 12 }]}
          contentStyle={styles.ctaContent}
        >
          Changer le mot de passe
        </Button>
      )}
      {passwordOk ? (
        <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
          Mot de passe mis à jour.
        </Text>
      ) : null}

      <Button
        mode="outlined"
        icon="logout"
        onPress={() => void signOut()}
        style={[styles.cta, { marginTop: 28, borderColor: theme.colors.error }]}
        contentStyle={styles.ctaContent}
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

      {activeHouse?.role === 'owner' ? (
        <View
          style={{ marginBottom: 12 }}
          onLayout={(e) => {
            addressBlockY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
          >
            Adresse
            {activeHouse.address?.trim()
              ? ` · ${activeHouse.address.trim()}`
              : ' · non renseignée'}
          </Text>
          {showAddressEdit ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <TextInput
                mode="outlined"
                dense
                label="Adresse"
                multiline
                value={addressDraft}
                onChangeText={setAddressDraft}
                onFocus={scrollAddressIntoView}
                style={{ backgroundColor: theme.colors.surface, minHeight: 72 }}
              />
              <View style={styles.addHouseActions}>
                <Button
                  compact
                  mode="text"
                  loading={updateHouseFields.isPending}
                  onPress={() => {
                    setError(null);
                    void updateHouseFields
                      .mutateAsync({ address: addressDraft.trim() })
                      .then(() => {
                        setShowAddressEdit(false);
                        setAddressDraft('');
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : 'enregistrement impossible'),
                      );
                  }}
                >
                  OK
                </Button>
                <Button compact onPress={() => setShowAddressEdit(false)}>
                  Annuler
                </Button>
              </View>
            </View>
          ) : (
            <Button
              compact
              mode="outlined"
              icon="map-marker-outline"
              onPress={() => {
                setAddressDraft(activeHouse.address ?? '');
                setShowAddressEdit(true);
              }}
              style={{ alignSelf: 'flex-start', marginBottom: 12 }}
            >
              {activeHouse.address?.trim() ? 'Modifier' : 'Définir'}
            </Button>
          )}

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
          >
            Chambres
            {(() => {
              const s = activeHouse.single_beds ?? 0;
              const d = activeHouse.double_beds ?? 0;
              if (s + d <= 0) return ' · non configurées';
              const parts: string[] = [];
              if (s > 0) parts.push(`${s} simple${s > 1 ? 's' : ''}`);
              if (d > 0) parts.push(`${d} double${d > 1 ? 's' : ''}`);
              return ` · ${parts.join(' · ')}`;
            })()}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline, marginBottom: 8 }}
          >
            Une chambre = un lit. Un lit double peut accueillir l’hôte + 1 invité.
          </Text>
          {showCapacityEdit ? (
            <View style={{ gap: 8, marginBottom: 4 }}>
              <View style={styles.addHouseActions}>
                <TextInput
                  mode="outlined"
                  dense
                  label="Lits simples"
                  keyboardType="number-pad"
                  value={singleBedsDraft}
                  onChangeText={setSingleBedsDraft}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
                <TextInput
                  mode="outlined"
                  dense
                  label="Lits doubles"
                  keyboardType="number-pad"
                  value={doubleBedsDraft}
                  onChangeText={setDoubleBedsDraft}
                  style={{ flex: 1, backgroundColor: theme.colors.surface }}
                />
              </View>
              <View style={styles.addHouseActions}>
                <Button
                  compact
                  mode="text"
                  loading={updateHouseFields.isPending}
                  onPress={() => {
                    const s = parseInt(singleBedsDraft, 10);
                    const d = parseInt(doubleBedsDraft, 10);
                    if (Number.isNaN(s) || s < 0 || Number.isNaN(d) || d < 0) {
                      setError('Nombre de lits invalide');
                      return;
                    }
                    setError(null);
                    void updateHouseFields
                      .mutateAsync({ single_beds: s, double_beds: d })
                      .then(() => {
                        setShowCapacityEdit(false);
                        setSingleBedsDraft('');
                        setDoubleBedsDraft('');
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : 'enregistrement impossible'),
                      );
                  }}
                >
                  OK
                </Button>
                <Button compact onPress={() => setShowCapacityEdit(false)}>
                  Annuler
                </Button>
              </View>
            </View>
          ) : (
            <Button
              compact
              mode="outlined"
              icon="bed"
              onPress={() => {
                setSingleBedsDraft(String(activeHouse.single_beds ?? 0));
                setDoubleBedsDraft(String(activeHouse.double_beds ?? 0));
                setShowCapacityEdit(true);
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              {(activeHouse.single_beds ?? 0) + (activeHouse.double_beds ?? 0) > 0
                ? 'Modifier'
                : 'Définir'}
            </Button>
          )}
        </View>
      ) : null}

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
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
  cta: {
    alignSelf: 'stretch',
    borderRadius: 12,
  },
  ctaContent: {
    justifyContent: 'flex-start',
    minHeight: 48,
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
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
