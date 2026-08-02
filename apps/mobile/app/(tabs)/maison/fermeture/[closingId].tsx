import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AuthedImage } from '@/components/AuthedImage';
import { Text, View } from '@/components/Themed';
import {
  useClosing,
  useCompleteClosing,
  useUpdateClosingItem,
} from '@/hooks/useClosing';
import { checklistPhotoUrl, type ClosingItem } from '@/lib/api';

export default function ClosingRunScreen() {
  const { closingId } = useLocalSearchParams<{ closingId: string }>();
  const closing = useClosing(closingId);
  const updateItem = useUpdateClosingItem(closingId);
  const complete = useCompleteClosing(closingId, closing.data?.house_id);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const items = closing.data?.items ?? [];
    const required = items.filter((i) => !i.optional);
    const doneReq = required.filter((i) => i.status === 'done').length;
    return { doneReq, required: required.length };
  }, [closing.data?.items]);

  if (closing.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
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

  const setStatus = (item: ClosingItem, status: ClosingItem['status']) => {
    setError(null);
    void updateItem.mutateAsync({ itemId: item.id, status }).catch((e) => {
      const msg = e instanceof Error ? e.message : 'erreur';
      if (msg.includes('cannot_skip')) {
        setError('Cette tâche est requise — elle ne peut pas être ignorée.');
      } else {
        setError(msg);
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.meta}>
        {open ? 'En cours' : 'Terminée'} · {progress.doneReq}/{progress.required} requises
      </Text>

      {detail.items.map((item) => {
        const checked = item.status === 'done';
        const skipped = item.status === 'skipped';
        return (
          <View key={item.id} style={styles.item}>
            <Pressable
              disabled={!open || updateItem.isPending}
              onPress={() => setStatus(item, checked ? 'todo' : 'done')}
              style={styles.itemHeader}
            >
              <RNView style={[styles.box, checked && styles.boxOn, skipped && styles.boxSkip]}>
                <Text style={styles.boxMark}>{checked ? '✓' : skipped ? '–' : ''}</Text>
              </RNView>
              <View style={styles.itemCopy}>
                <Text style={[styles.itemTitle, (checked || skipped) && styles.itemDone]}>
                  {item.label}
                </Text>
                <Text style={styles.badges}>{item.optional ? 'Optionnelle' : 'Requise'}</Text>
              </View>
            </Pressable>

            {item.photos?.length ? (
              <ScrollView horizontal style={styles.photos} showsHorizontalScrollIndicator={false}>
                {item.photos.map((p) => (
                  <AuthedImage
                    key={p.id}
                    url={checklistPhotoUrl(p.id)}
                    cacheKey={p.id}
                    style={styles.photo}
                  />
                ))}
              </ScrollView>
            ) : null}

            {open && item.optional ? (
              <View style={styles.actions}>
                {!skipped ? (
                  <Pressable onPress={() => setStatus(item, 'skipped')}>
                    <Text style={styles.link}>Ignorer</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setStatus(item, 'todo')}>
                    <Text style={styles.link}>Réactiver</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {open ? (
        <Pressable
          style={[styles.button, complete.isPending && styles.disabled]}
          disabled={complete.isPending}
          onPress={() => {
            setError(null);
            void complete.mutateAsync().catch((e) => {
              const msg = e instanceof Error ? e.message : 'erreur';
              if (msg.includes('required_pending')) {
                setError('Termine toutes les tâches requises.');
              } else {
                setError(msg);
              }
            });
          }}
        >
          <Text style={styles.buttonText}>
            {complete.isPending ? '…' : 'Terminer la fermeture'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.doneHint}>Fermeture enregistrée.</Text>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    opacity: 0.55,
    marginBottom: 16,
    fontSize: 13,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#1a1612',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: {
    backgroundColor: '#1a1612',
  },
  boxSkip: {
    borderColor: '#999',
    backgroundColor: '#eee',
  },
  boxMark: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemDone: {
    opacity: 0.45,
    textDecorationLine: 'line-through',
  },
  badges: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.55,
  },
  photos: {
    marginTop: 12,
    marginLeft: 40,
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 8,
    marginRight: 10,
  },
  actions: {
    marginTop: 10,
    marginLeft: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    opacity: 0.7,
    fontSize: 13,
  },
  button: {
    marginTop: 28,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  doneHint: {
    marginTop: 28,
    opacity: 0.7,
    textAlign: 'center',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
  },
});
