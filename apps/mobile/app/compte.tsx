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
  IconButton,
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
import {
  DISPLAY_NAME_MAX_LEN,
  hasDisplayName,
  normalizeDisplayName,
} from '@/lib/displayName';
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
  const [showHouseSwitcher, setShowHouseSwitcher] = useState(false);
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
    const name = normalizeDisplayName(displayName);
    if (!name) {
      setError(
        displayName.trim().length > DISPLAY_NAME_MAX_LEN
          ? '80 caractères maximum'
          : 'Le nom d’affichage est obligatoire',
      );
      return;
    }
    try {
      await updateName.mutateAsync(name);
      setShowNameEdit(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'enregistrement impossible';
      setError(
        raw === 'display_name_required'
          ? 'Le nom d’affichage est obligatoire'
          : raw === 'display_name_too_long'
            ? '80 caractères maximum'
            : raw,
      );
    }
  }, [displayName, updateName]);

  const closeNameEdit = useCallback(() => {
    setShowNameEdit(false);
    setDisplayName(me.data?.display_name || '');
    setError(null);
  }, [me.data?.display_name]);

  const pickAvatar = useCallback(() => {
    setError(null);
    Alert.alert('Photo de profil', undefined, [
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
        setShowHouseSwitcher(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'sélection impossible');
      }
    },
    [selectHouse],
  );

  const email = me.data?.email || null;
  const queryError =
    (me.error instanceof Error && me.error.message) ||
    (houses.error instanceof Error && houses.error.message) ||
    null;
  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase();
  const named = hasDisplayName(me.data ?? {});
  const otherHouses = (houses.data ?? []).filter((h) => h.id !== currentHouseId.data);
  const bedSummary = (() => {
    if (!activeHouse) return 'Non configurées';
    const s = activeHouse.single_beds ?? 0;
    const d = activeHouse.double_beds ?? 0;
    if (s + d <= 0) return 'Non configurées';
    const parts: string[] = [];
    if (s > 0) parts.push(`${s} simple${s > 1 ? 's' : ''}`);
    if (d > 0) parts.push(`${d} double${d > 1 ? 's' : ''}`);
    return parts.join(' · ');
  })();

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
        {/* —— Identité —— */}
        <View style={styles.identity}>
          <Pressable
            onPress={pickAvatar}
            accessibilityLabel="Changer la photo de profil"
            disabled={uploadAvatar.isPending || removeAvatar.isPending}
          >
            {me.data?.has_avatar && me.data.sub ? (
              <AuthedImage
                url={avatarUrl(me.data.sub)}
                cacheKey={`avatar-${me.data.sub}-${me.data.updated_at ?? ''}`}
                style={styles.avatarImg}
              />
            ) : (
              <Avatar.Text
                size={96}
                label={initial}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                labelStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}
              />
            )}
          </Pressable>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.primary, marginTop: 10, fontWeight: '600' }}
            onPress={pickAvatar}
          >
            {uploadAvatar.isPending ? 'Envoi…' : 'Changer la photo'}
          </Text>

          {showNameEdit ? (
            <View style={styles.nameEdit}>
              <TextInput
                mode="outlined"
                label="Prénom ou surnom"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={DISPLAY_NAME_MAX_LEN}
                autoCapitalize="words"
                autoFocus
                style={{ backgroundColor: theme.colors.surface }}
              />
              <View style={styles.ctaRow}>
                {named ? (
                  <Button compact onPress={closeNameEdit}>
                    Annuler
                  </Button>
                ) : null}
                <Button
                  compact
                  mode="contained-tonal"
                  onPress={() => void onSaveName()}
                  loading={updateName.isPending}
                  disabled={updateName.isPending || !normalizeDisplayName(displayName)}
                >
                  Enregistrer
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text
                variant="headlineSmall"
                style={{
                  color: theme.colors.onBackground,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                  flexShrink: 1,
                  textAlign: 'center',
                }}
              >
                {displayName.trim() || 'Sans nom'}
              </Text>
              <IconButton
                icon="pencil-outline"
                size={20}
                onPress={() => {
                  setDisplayName(me.data?.display_name || '');
                  setShowNameEdit(true);
                }}
                accessibilityLabel="Modifier le nom d’affichage"
              />
            </View>
          )}

          {email ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
            >
              {email}
            </Text>
          ) : null}

          {!named && !showNameEdit ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.error,
                marginTop: 12,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Choisis un nom pour que les autres te reconnaissent dans la maison.
            </Text>
          ) : null}
        </View>

        <Divider style={styles.divider} />

        {/* —— Sécurité —— */}
        <Text
          variant="labelLarge"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Sécurité
        </Text>

        {showPasswordEdit ? (
          <View style={styles.inlineForm}>
            <TextInput
              mode="outlined"
              label="Mot de passe actuel"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={styles.field}
            />
            <TextInput
              mode="outlined"
              label="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={styles.field}
            />
            <TextInput
              mode="outlined"
              label="Confirmer"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.field}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Au moins 12 caractères.
            </Text>
            <View style={styles.ctaRow}>
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
          <List.Item
            title="Changer le mot de passe"
            left={(props) => <List.Icon {...props} icon="lock-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              setPasswordOk(false);
              setShowPasswordEdit(true);
            }}
            style={styles.listRow}
          />
        )}
        {passwordOk ? (
          <Text style={{ color: theme.colors.primary, marginBottom: 8 }}>
            Mot de passe mis à jour.
          </Text>
        ) : null}

        <List.Item
          title="Se déconnecter"
          titleStyle={{ color: theme.colors.error }}
          left={(props) => (
            <List.Icon {...props} icon="logout" color={theme.colors.error} />
          )}
          onPress={() => void signOut()}
          style={styles.listRow}
        />

        <Divider style={styles.divider} />

        {/* —— Maison active uniquement —— */}
        <Text
          variant="labelLarge"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Cette maison
        </Text>

        {houses.isLoading ? (
          <ActivityIndicator animating color={theme.colors.primary} />
        ) : !activeHouse ? (
          <Text style={{ color: theme.colors.outline, marginBottom: 8 }}>
            Aucune maison pour l’instant.
          </Text>
        ) : (
          <>
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.onBackground,
                fontWeight: '700',
                marginBottom: 4,
              }}
            >
              {activeHouse.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
            >
              {activeHouse.role === 'owner' ? 'Tu es propriétaire' : 'Tu es membre'}
            </Text>

            {activeHouse.role === 'owner' ? (
              <View
                onLayout={(e) => {
                  addressBlockY.current = e.nativeEvent.layout.y;
                }}
              >
                {showAddressEdit ? (
                  <View style={styles.inlineForm}>
                    <TextInput
                      mode="outlined"
                      dense
                      label="Adresse"
                      multiline
                      value={addressDraft}
                      onChangeText={setAddressDraft}
                      onFocus={scrollAddressIntoView}
                      style={[styles.field, { minHeight: 72 }]}
                    />
                    <View style={styles.ctaRow}>
                      <Button compact onPress={() => setShowAddressEdit(false)}>
                        Annuler
                      </Button>
                      <Button
                        compact
                        mode="contained-tonal"
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
                              setError(
                                e instanceof Error ? e.message : 'enregistrement impossible',
                              ),
                            );
                        }}
                      >
                        Enregistrer
                      </Button>
                    </View>
                  </View>
                ) : (
                  <List.Item
                    title="Adresse"
                    description={
                      activeHouse.address?.trim() || 'Non renseignée — appuie pour définir'
                    }
                    descriptionNumberOfLines={3}
                    left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => {
                      setAddressDraft(activeHouse.address ?? '');
                      setShowAddressEdit(true);
                    }}
                    style={styles.listRow}
                  />
                )}

                {showCapacityEdit ? (
                  <View style={styles.inlineForm}>
                    <View style={styles.bedRow}>
                      <TextInput
                        mode="outlined"
                        dense
                        label="Lits simples"
                        keyboardType="number-pad"
                        value={singleBedsDraft}
                        onChangeText={setSingleBedsDraft}
                        style={[styles.field, { flex: 1 }]}
                      />
                      <TextInput
                        mode="outlined"
                        dense
                        label="Lits doubles"
                        keyboardType="number-pad"
                        value={doubleBedsDraft}
                        onChangeText={setDoubleBedsDraft}
                        style={[styles.field, { flex: 1 }]}
                      />
                    </View>
                    <View style={styles.ctaRow}>
                      <Button compact onPress={() => setShowCapacityEdit(false)}>
                        Annuler
                      </Button>
                      <Button
                        compact
                        mode="contained-tonal"
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
                              setError(
                                e instanceof Error ? e.message : 'enregistrement impossible',
                              ),
                            );
                        }}
                      >
                        Enregistrer
                      </Button>
                    </View>
                  </View>
                ) : (
                  <List.Item
                    title="Chambres"
                    description={bedSummary}
                    left={(props) => <List.Icon {...props} icon="bed-outline" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => {
                      setSingleBedsDraft(String(activeHouse.single_beds ?? 0));
                      setDoubleBedsDraft(String(activeHouse.double_beds ?? 0));
                      setShowCapacityEdit(true);
                    }}
                    style={styles.listRow}
                  />
                )}
              </View>
            ) : null}

            {otherHouses.length > 0 ? (
              <>
                <Button
                  mode="text"
                  compact
                  icon={showHouseSwitcher ? 'chevron-up' : 'swap-horizontal'}
                  onPress={() => setShowHouseSwitcher((v) => !v)}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                >
                  {showHouseSwitcher ? 'Masquer' : 'Changer de maison'}
                </Button>
                {showHouseSwitcher
                  ? otherHouses.map((h) => (
                      <List.Item
                        key={h.id}
                        title={h.name}
                        description={h.role}
                        left={(props) => <List.Icon {...props} icon="home-outline" />}
                        onPress={() => void onSelectHouse(h.id)}
                        style={styles.listRow}
                      />
                    ))
                  : null}
              </>
            ) : null}
          </>
        )}

        {!showAddHouse ? (
          <Pressable onPress={() => setShowAddHouse(true)} style={styles.addHouseLink}>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Ajouter une maison…
            </Text>
          </Pressable>
        ) : (
          <View style={styles.inlineForm}>
            <TextInput
              mode="outlined"
              dense
              label="Nom de la maison"
              value={newHouse}
              onChangeText={setNewHouse}
              style={styles.field}
            />
            <View style={styles.ctaRow}>
              <Button compact onPress={() => setShowAddHouse(false)}>
                Annuler
              </Button>
              <Button
                compact
                mode="contained-tonal"
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
          <Text style={{ color: theme.colors.error, marginTop: 16 }}>
            {error || queryError}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  identity: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    maxWidth: '100%',
    paddingHorizontal: 8,
  },
  nameEdit: {
    alignSelf: 'stretch',
    marginTop: 16,
    gap: 8,
  },
  sectionLabel: {
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    marginVertical: 22,
  },
  listRow: {
    marginHorizontal: -8,
    borderRadius: 10,
  },
  inlineForm: {
    gap: 8,
    marginBottom: 8,
  },
  field: {
    backgroundColor: 'transparent',
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  bedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addHouseLink: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
});
