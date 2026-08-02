import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthedImage } from '@/components/AuthedImage';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Text, View, useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';
import {
  useClosing,
  useCompleteClosing,
  useUpdateClosingItem,
} from '@/hooks/useClosing';
import { checklistPhotoUrl, type ClosingItem } from '@/lib/api';

export default function ClosingRunScreen() {
  const insets = useSafeAreaInsets();
  const surface = useThemeColor({ light: Brand.surface, dark: '#1c1c1e' }, 'background');
  const surfaceDone = useThemeColor({ light: '#eef5f0', dark: '#1a2a22' }, 'background');
  const boxBorder = useThemeColor({ light: Brand.ink, dark: '#e8e4df' }, 'text');
  const skipBorder = useThemeColor({ light: '#b8b2a8', dark: '#666' }, 'text');
  const footerBg = useThemeColor({ light: '#fffffff5', dark: '#000000f2' }, 'background');
  const footerLine = useThemeColor({ light: Brand.line, dark: '#333' }, 'text');

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
    return { doneReq, required: required.length, remaining };
  }, [closing.data?.items]);

  if (closing.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.ink} />
      </View>
    );
  }

  if (!closing.data) {
    return (
      <View style={styles.pad}>
        <Text style={styles.err}>Fermeture introuvable.</Text>
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
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: open ? 120 + insets.bottom : 48 }]}
      >
        <View style={styles.progressBlock}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {open
                ? progress.remaining === 0
                  ? 'Tout est fait'
                  : `${progress.remaining} requise${progress.remaining > 1 ? 's' : ''} restante${progress.remaining > 1 ? 's' : ''}`
                : 'Fermeture terminée'}
            </Text>
            <Text style={styles.progressCount}>
              {progress.doneReq}/{progress.required}
            </Text>
          </View>
          <ProgressBar value={progress.doneReq} total={progress.required} />
        </View>

        {detail.items.map((item) => {
          const checked = item.status === 'done';
          const skipped = item.status === 'skipped';
          const bg = checked ? surfaceDone : skipped ? surface : undefined;

          return (
            <View
              key={item.id}
              style={[styles.item, bg ? { backgroundColor: bg } : null]}
            >
              <Pressable
                disabled={!open || updateItem.isPending}
                onPress={() => setStatus(item, checked ? 'todo' : 'done')}
                style={styles.itemHeader}
              >
                <RNView
                  style={[
                    styles.box,
                    { borderColor: skipped ? skipBorder : boxBorder },
                    checked && styles.boxOn,
                    skipped && styles.boxSkip,
                  ]}
                >
                  <Text style={[styles.boxMark, skipped && styles.boxMarkSkip]}>
                    {checked ? '✓' : skipped ? '–' : ''}
                  </Text>
                </RNView>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemTitle, (checked || skipped) && styles.itemMuted]}>
                    {item.label}
                  </Text>
                  {item.optional ? (
                    <Text style={styles.optional}>Optionnelle</Text>
                  ) : null}
                </View>
              </Pressable>

              {item.photos?.length ? (
                <View style={styles.hintBlock}>
                  <Text style={styles.hintLabel}>Indication</Text>
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
                <Pressable
                  onPress={() => setStatus(item, skipped ? 'todo' : 'skipped')}
                  style={styles.skipBtn}
                  hitSlop={8}
                >
                  <Text style={styles.skipText}>
                    {skipped ? 'Remettre à faire' : 'Passer'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {!open ? (
          <Text style={styles.doneHint}>Cette fermeture est enregistrée.</Text>
        ) : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>

      {open ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: footerBg,
              borderTopColor: footerLine,
            },
          ]}
        >
          <PrimaryButton
            label={
              canFinish
                ? 'Terminer la fermeture'
                : `Encore ${progress.remaining} requise${progress.remaining > 1 ? 's' : ''}`
            }
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
            disabled={!canFinish}
            busy={complete.isPending}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    marginBottom: 18,
    gap: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 13,
    opacity: 0.45,
    fontWeight: '600',
  },
  item: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  box: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: {
    backgroundColor: Brand.ink,
    borderColor: Brand.ink,
  },
  boxSkip: {
    backgroundColor: 'transparent',
  },
  boxMark: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 15,
  },
  boxMarkSkip: {
    color: Brand.inkMuted,
  },
  itemCopy: {
    flex: 1,
    paddingTop: 2,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  itemMuted: {
    opacity: 0.4,
  },
  optional: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.45,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hintBlock: {
    marginTop: 12,
    marginLeft: 44,
  },
  hintLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: 8,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 12,
    marginRight: 10,
  },
  skipBtn: {
    marginTop: 10,
    marginLeft: 44,
    alignSelf: 'flex-start',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.55,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneHint: {
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.55,
    fontSize: 15,
  },
  err: {
    marginTop: 16,
    color: Brand.danger,
    textAlign: 'center',
  },
});
