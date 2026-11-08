import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Chip,
  IconButton,
  ProgressBar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import {
  useCancelClosing,
  useClosing,
  useCompleteClosing,
  useDeleteClosing,
  useUpdateClosingItem,
  useUpdateClosingNotes,
} from '@/hooks/useClosing';
import { checklistPhotoUrl, type ClosingItem } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

function itemHasContext(item: ClosingItem): boolean {
  return Boolean(item.description?.trim() || item.photos?.length);
}

function sortChecklistItems(items: ClosingItem[]): ClosingItem[] {
  return [...items].sort((a, b) => {
    if (a.optional !== b.optional) return a.optional ? 1 : -1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.label.localeCompare(b.label, 'fr');
  });
}

export default function ClosingRunScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { closingId } = useLocalSearchParams<{ closingId: string }>();
  const closing = useClosing(closingId);
  const updateItem = useUpdateClosingItem(closingId);
  const updateNotes = useUpdateClosingNotes(closingId, closing.data?.house_id);
  const complete = useCompleteClosing(closingId, closing.data?.house_id);
  const cancel = useCancelClosing(closingId, closing.data?.house_id);
  const removeClosing = useDeleteClosing(closing.data?.house_id);
  const [error, setError] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [finishNotesOpen, setFinishNotesOpen] = useState(false);

  const progress = useMemo(() => {
    const items = closing.data?.items ?? [];
    const required = items.filter((i) => !i.optional);
    const doneReq = required.filter((i) => i.status === 'done').length;
    const remaining = required.length - doneReq;
    const ratio = required.length === 0 ? 1 : doneReq / required.length;
    return { doneReq, required: required.length, remaining, ratio };
  }, [closing.data?.items]);

  const items = useMemo(
    () => sortChecklistItems(closing.data?.items ?? []),
    [closing.data?.items],
  );

  const detailItem = useMemo(
    () => items.find((i) => i.id === detailItemId) ?? null,
    [items, detailItemId],
  );

  useEffect(() => {
    if (closing.data) {
      setNotesDraft(closing.data.notes ?? '');
    }
  }, [closing.data?.id, closing.data?.notes]);

  if (closing.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!closing.data) {
    return (
      <View style={[styles.pad, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>Fermeture introuvable.</Text>
      </View>
    );
  }

  const detail = closing.data;
  const open = detail.status === 'open';
  const cancelled = detail.status === 'cancelled';
  const requiredDone = progress.remaining === 0;
  const hasGlobalNotes = Boolean(detail.notes?.trim());

  const setStatus = (item: ClosingItem, status: ClosingItem['status']) => {
    setError(null);
    void updateItem.mutateAsync({ itemId: item.id, status }).catch((e) => {
      const msg = e instanceof Error ? e.message : 'erreur';
      if (msg.includes('cannot_skip')) {
        setError('Cette tâche est requise.');
      } else {
        setError(msg);
      }
    });
  };

  const openDetail = (item: ClosingItem) => {
    if (!itemHasContext(item)) return;
    setDetailItemId(item.id);
  };

  const goFermetureHub = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/maison/fermeture');
    }
  };

  const runComplete = () => {
    setError(null);
    void complete.mutateAsync().catch((e) => {
      const msg = e instanceof Error ? e.message : 'erreur';
      if (msg.includes('required_pending')) {
        setError('Coche d’abord toutes les tâches requises.');
        setFinishNotesOpen(false);
      } else if (msg.includes('notes_pending')) {
        setFinishNotesOpen(true);
      } else {
        setError(msg);
      }
    });
  };

  const confirmAndFinish = (notes: string) => {
    setError(null);
    void updateNotes
      .mutateAsync(notes)
      .then(() => {
        setFinishNotesOpen(false);
        runComplete();
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'enregistrement impossible'));
  };

  const onPressFinish = () => {
    if (!requiredDone) return;
    setError(null);
    if (detail.notes_done) {
      runComplete();
      return;
    }
    setNotesDraft(detail.notes ?? '');
    setFinishNotesOpen(true);
  };

  const confirmCancel = () => {
    Alert.alert(
      'Annuler cette fermeture ?',
      'La checklist en cours sera abandonnée. Tu pourras en recommencer une après.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            setError(null);
            void cancel
              .mutateAsync()
              .then(goFermetureHub)
              .catch((e) => {
                setError(e instanceof Error ? e.message : 'annulation impossible');
              });
          },
        },
      ],
    );
  };

  const confirmDeletePast = () => {
    if (!closingId) return;
    Alert.alert(
      'Supprimer cette fermeture ?',
      'Elle sera retirée de l’historique.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setError(null);
            void removeClosing
              .mutateAsync(closingId)
              .then(goFermetureHub)
              .catch((e) => {
                setError(e instanceof Error ? e.message : 'suppression impossible');
              });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: open ? 160 + insets.bottom : 48 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Surface
          style={[styles.progressCard, { backgroundColor: theme.colors.elevation.level1 }]}
          elevation={0}
        >
          <View style={styles.progressRow}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
              {open
                ? requiredDone
                  ? 'Tout est fait'
                  : `${progress.remaining} requise${progress.remaining > 1 ? 's' : ''} restante${progress.remaining > 1 ? 's' : ''}`
                : cancelled
                  ? 'Fermeture annulée'
                  : 'Fermeture terminée'}
            </Text>
            <Chip compact style={{ backgroundColor: theme.colors.secondaryContainer }}>
              {progress.doneReq}/{progress.required}
            </Chip>
          </View>
          <ProgressBar
            progress={progress.ratio}
            color={theme.colors.primary}
            style={styles.bar}
          />
        </Surface>

        {items.map((item) => {
          const checked = item.status === 'done';
          const skipped = item.status === 'skipped';
          const status: 'checked' | 'unchecked' | 'indeterminate' = checked
            ? 'checked'
            : skipped
              ? 'indeterminate'
              : 'unchecked';
          const hasContext = itemHasContext(item);

          return (
            <Surface
              key={item.id}
              style={[
                styles.item,
                {
                  backgroundColor: checked
                    ? theme.colors.secondaryContainer
                    : theme.colors.elevation.level1,
                  opacity: skipped ? 0.72 : 1,
                },
              ]}
              elevation={0}
            >
              <View style={styles.itemHeader}>
                <Checkbox.Android
                  status={status}
                  disabled={!open || updateItem.isPending}
                  onPress={() => {
                    if (!open) return;
                    if (skipped) {
                      setStatus(item, 'todo');
                      return;
                    }
                    setStatus(item, checked ? 'todo' : 'done');
                  }}
                  color={theme.colors.primary}
                />
                <View style={styles.itemCopy}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      fontWeight: '600',
                      textDecorationLine: checked || skipped ? 'line-through' : 'none',
                      opacity: checked || skipped ? 0.55 : 1,
                    }}
                  >
                    {item.label}
                  </Text>
                  {item.optional ? (
                    <Chip
                      compact
                      style={styles.optionalChip}
                      textStyle={{ fontSize: 11 }}
                    >
                      Optionnelle
                    </Chip>
                  ) : null}
                </View>
                {hasContext ? (
                  <IconButton
                    icon="information-outline"
                    size={22}
                    iconColor={theme.colors.primary}
                    accessibilityLabel="Indication de la tâche"
                    onPress={() => openDetail(item)}
                  />
                ) : null}
              </View>

              {open && item.optional ? (
                <Button
                  mode="text"
                  compact
                  onPress={() => setStatus(item, skipped ? 'todo' : 'skipped')}
                  style={styles.skipBtn}
                >
                  {skipped ? 'Remettre à faire' : 'Passer'}
                </Button>
              ) : null}
            </Surface>
          );
        })}

        {!open && (hasGlobalNotes || detail.notes_done) ? (
          <Surface
            style={[styles.notesReadonly, { backgroundColor: theme.colors.elevation.level1 }]}
            elevation={0}
          >
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 0.5, marginBottom: 8 }}
            >
              NOTES DE FERMETURE
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, lineHeight: 22 }}>
              {hasGlobalNotes ? detail.notes : 'Rien à signaler'}
            </Text>
          </Surface>
        ) : null}

        {!open ? (
          <View style={{ marginTop: 20, alignItems: 'center', gap: 12 }}>
            <Text
              variant="bodyLarge"
              style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}
            >
              {cancelled
                ? 'Cette fermeture a été annulée.'
                : 'Cette fermeture est enregistrée.'}
            </Text>
            <Button
              mode="outlined"
              icon="delete-outline"
              textColor={theme.colors.error}
              loading={removeClosing.isPending}
              onPress={confirmDeletePast}
              style={{ borderRadius: 14 }}
            >
              Supprimer de l’historique
            </Button>
          </View>
        ) : null}
        {error ? (
          <Text style={{ color: theme.colors.error, textAlign: 'center', marginTop: 16 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {open ? (
        <Surface
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
          elevation={2}
        >
          <Button
            mode="contained"
            icon="check-bold"
            disabled={!requiredDone || cancel.isPending || complete.isPending || updateNotes.isPending}
            loading={complete.isPending || updateNotes.isPending}
            onPress={onPressFinish}
            contentStyle={{ minHeight: 52 }}
            style={{ borderRadius: 16 }}
          >
            {requiredDone
              ? 'Terminer la fermeture'
              : `Encore ${progress.remaining} requise${progress.remaining > 1 ? 's' : ''}`}
          </Button>
          <Button
            mode="text"
            icon="close-circle-outline"
            disabled={complete.isPending || cancel.isPending}
            loading={cancel.isPending}
            onPress={confirmCancel}
            textColor={theme.colors.error}
            style={{ marginTop: 4 }}
          >
            Annuler la fermeture
          </Button>
        </Surface>
      ) : null}

      {/* Finish notes modal */}
      <Modal
        visible={finishNotesOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFinishNotesOpen(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: theme.colors.backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFinishNotesOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.elevation.level2,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text
                variant="titleLarge"
                style={{ color: theme.colors.onSurface, fontWeight: '700', flex: 1 }}
              >
                Notes de fermeture
              </Text>
              <IconButton
                icon="close"
                onPress={() => setFinishNotesOpen(false)}
                accessibilityLabel="Fermer"
              />
            </View>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12, lineHeight: 20 }}
            >
              Un mot pour la suite : problème rencontré, clé, porte, poubelle…
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={5}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Commentaire (optionnel)"
              style={{ backgroundColor: theme.colors.surface, marginBottom: 12 }}
            />
            <View style={styles.notesActions}>
              <Button
                mode="outlined"
                loading={updateNotes.isPending || complete.isPending}
                onPress={() => confirmAndFinish('')}
                contentStyle={{ minHeight: 48 }}
                style={{ borderRadius: 14, flex: 1 }}
              >
                Rien à signaler
              </Button>
              <Button
                mode="contained"
                loading={updateNotes.isPending || complete.isPending}
                onPress={() => confirmAndFinish(notesDraft.trim())}
                contentStyle={{ minHeight: 48 }}
                style={{ borderRadius: 14, flex: 1 }}
              >
                Terminer
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task context modal */}
      <Modal
        visible={!!detailItem}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItemId(null)}
      >
        <View style={[styles.modalRoot, { backgroundColor: theme.colors.backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailItemId(null)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.elevation.level2,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            {detailItem ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                <View style={styles.sheetHeader}>
                  <Text
                    variant="titleLarge"
                    style={{ color: theme.colors.onSurface, fontWeight: '700', flex: 1 }}
                  >
                    {detailItem.label}
                  </Text>
                  <IconButton
                    icon="close"
                    onPress={() => setDetailItemId(null)}
                    accessibilityLabel="Fermer"
                  />
                </View>

                {detailItem.description?.trim() ? (
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      lineHeight: 24,
                      marginBottom: 16,
                    }}
                  >
                    {detailItem.description}
                  </Text>
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.outline, marginBottom: 16 }}
                  >
                    Pas de description.
                  </Text>
                )}

                {detailItem.photos?.length ? (
                  <View>
                    <Text
                      variant="labelLarge"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginBottom: 8,
                        letterSpacing: 0.5,
                      }}
                    >
                      INDICATION
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {detailItem.photos.map((p) => (
                        <AuthedImage
                          key={p.id}
                          url={checklistPhotoUrl(p.id)}
                          cacheKey={p.id}
                          style={styles.photo}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  bar: { height: 8, borderRadius: 99 },
  item: {
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCopy: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 4,
  },
  optionalChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  notesReadonly: {
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 14,
    marginRight: 10,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    marginLeft: 40,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
});
