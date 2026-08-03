import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Chip,
  ProgressBar,
  Surface,
  Text,
} from 'react-native-paper';

import { AuthedImage } from '@/components/AuthedImage';
import {
  useClosing,
  useCompleteClosing,
  useUpdateClosingItem,
} from '@/hooks/useClosing';
import { checklistPhotoUrl, type ClosingItem } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

export default function ClosingRunScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { closingId } = useLocalSearchParams<{ closingId: string }>();
  const closing = useClosing(closingId);
  const updateItem = useUpdateClosingItem(closingId);
  const complete = useCompleteClosing(closingId, closing.data?.house_id);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const items = closing.data?.items ?? [];
    const required = items.filter((i) => !i.optional);
    const doneReq = required.filter((i) => i.status === 'done').length;
    const remaining = required.length - doneReq;
    const ratio = required.length === 0 ? 0 : doneReq / required.length;
    return { doneReq, required: required.length, remaining, ratio };
  }, [closing.data?.items]);

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
  const canFinish = open && progress.remaining === 0;

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

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: open ? 120 + insets.bottom : 48 },
        ]}
      >
        <Surface
          style={[styles.progressCard, { backgroundColor: theme.colors.elevation.level1 }]}
          elevation={0}
        >
          <View style={styles.progressRow}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
              {open
                ? progress.remaining === 0
                  ? 'Tout est fait'
                  : `${progress.remaining} requise${progress.remaining > 1 ? 's' : ''} restante${progress.remaining > 1 ? 's' : ''}`
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

        {detail.items.map((item) => {
          const checked = item.status === 'done';
          const skipped = item.status === 'skipped';
          const status: 'checked' | 'unchecked' | 'indeterminate' = checked
            ? 'checked'
            : skipped
              ? 'indeterminate'
              : 'unchecked';

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
                  {item.description?.trim() ? (
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 4,
                        lineHeight: 20,
                        opacity: checked || skipped ? 0.55 : 1,
                      }}
                    >
                      {item.description}
                    </Text>
                  ) : null}
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
              </View>

              {item.photos?.length ? (
                <View style={styles.hintBlock}>
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.primary, marginBottom: 8, fontWeight: '700' }}
                  >
                    INDICATION
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {item.photos.map((p) => (
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

        {!open ? (
          <Text
            variant="bodyLarge"
            style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}
          >
            Cette fermeture est enregistrée.
          </Text>
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
            disabled={!canFinish}
            loading={complete.isPending}
            onPress={() => {
              setError(null);
              void complete.mutateAsync().catch((e) => {
                const msg = e instanceof Error ? e.message : 'erreur';
                if (msg.includes('required_pending')) {
                  setError('Coche d’abord toutes les tâches requises.');
                } else {
                  setError(msg);
                }
              });
            }}
            contentStyle={{ minHeight: 52 }}
            style={{ borderRadius: 16 }}
          >
            {canFinish
              ? 'Terminer la fermeture'
              : `Encore ${progress.remaining} requise${progress.remaining > 1 ? 's' : ''}`}
          </Button>
        </Surface>
      ) : null}
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemCopy: {
    flex: 1,
    paddingTop: 8,
    paddingRight: 8,
  },
  optionalChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  hintBlock: {
    marginLeft: 48,
    marginTop: 4,
    marginBottom: 4,
  },
  photo: {
    width: 100,
    height: 100,
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
});
