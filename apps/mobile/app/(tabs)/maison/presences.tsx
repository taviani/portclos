import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useCurrentHouse, useMe } from '@/hooks/useHouses';
import {
  monthKey,
  useCreateOccupation,
  useDeleteOccupation,
  useOccupations,
} from '@/hooks/useOccupations';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function inRange(day: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const lo = compareISO(start, end) <= 0 ? start : end;
  const hi = compareISO(start, end) <= 0 ? end : start;
  return day >= lo && day <= hi;
}

export default function PresencesScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');
  const dayOccupiedBg = useThemeColor({ light: '#dceaf5', dark: '#1e3a4f' }, 'background');
  const rangeBg = useThemeColor({ light: '#c8e0c8', dark: '#1f3d2a' }, 'background');
  const endpointBg = useThemeColor({ light: '#1a1612', dark: '#e8e4df' }, 'background');
  const endpointFg = useThemeColor({ light: '#fff', dark: '#1a1612' }, 'text');

  const { house, isLoading, error } = useCurrentHouse();
  const me = useMe();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const occupations = useOccupations(house?.id, month);
  const createOcc = useCreateOccupation(house?.id);
  const deleteOcc = useDeleteOccupation(house?.id);

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedStart =
    rangeStart && rangeEnd
      ? compareISO(rangeStart, rangeEnd) <= 0
        ? rangeStart
        : rangeEnd
      : rangeStart;
  const selectedEnd =
    rangeStart && rangeEnd
      ? compareISO(rangeStart, rangeEnd) <= 0
        ? rangeEnd
        : rangeStart
      : rangeEnd;

  const onDayPress = useCallback(
    (day: string) => {
      setFormError(null);
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(day);
        setRangeEnd(null);
        return;
      }
      setRangeEnd(day);
    },
    [rangeStart, rangeEnd],
  );

  const clearSelection = useCallback(() => {
    setRangeStart(null);
    setRangeEnd(null);
    setFormError(null);
  }, []);

  const occupiedDays = useMemo(() => {
    const set = new Set<string>();
    for (const o of occupations.data ?? []) {
      const [ys, ms, ds] = o.start_date.split('-').map(Number);
      const [ye, meDay, de] = o.end_date.split('-').map(Number);
      const cur = new Date(ys, ms - 1, ds);
      const end = new Date(ye, meDay - 1, de);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (key.startsWith(month)) set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [occupations.data, month]);

  const calendarDays = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const startPad = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Array<{ label: string; key: string | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ label: '', key: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      cells.push({ label: String(d), key });
    }
    return cells;
  }, [month]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.sub}>
          Choisis ou crée une maison dans l’onglet Compte.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push('/(tabs)/me')}>
          <Text style={styles.buttonText}>Ouvrir Compte</Text>
        </Pressable>
      </View>
    );
  }

  const canSave = !!selectedStart && !!selectedEnd && !createOcc.isPending;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))}>
          <Text style={styles.monthNav}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))}>
          <Text style={styles.monthNav}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.hintCentered}>
        {!rangeStart
          ? 'Touche le jour de début, puis le jour de fin.'
          : !rangeEnd
            ? `Début ${formatDay(rangeStart)} — touche la fin.`
            : `${formatDay(selectedStart!)} → ${formatDay(selectedEnd!)}`}
      </Text>

      <View style={styles.weekHeader}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {calendarDays.map((cell, i) => {
          if (!cell.key) {
            return <View key={`pad-${i}`} style={styles.dayCell} />;
          }
          const occupied = occupiedDays.has(cell.key);
          const isStart = cell.key === selectedStart;
          const isEnd = cell.key === selectedEnd;
          const isEndpoint = isStart || isEnd;
          const inSel = inRange(cell.key, selectedStart, selectedEnd);
          return (
            <Pressable
              key={cell.key}
              onPress={() => onDayPress(cell.key!)}
              style={[
                styles.dayCell,
                occupied && !inSel && { backgroundColor: dayOccupiedBg },
                inSel && !isEndpoint && { backgroundColor: rangeBg },
                isEndpoint && { backgroundColor: endpointBg },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isEndpoint && { color: endpointFg, fontWeight: '700' },
                ]}
              >
                {cell.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {(rangeStart || rangeEnd) && (
        <Pressable onPress={clearSelection} style={styles.clearBtn}>
          <Text style={styles.clearText}>Effacer la sélection</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Occupations</Text>
      {occupations.isLoading ? (
        <ActivityIndicator />
      ) : (occupations.data?.length ?? 0) === 0 ? (
        <Text style={styles.hint}>Aucune occupation ce mois-ci.</Text>
      ) : (
        occupations.data!.map((o) => {
          const mine = o.user_sub === me.data?.sub;
          return (
            <View key={o.id} style={styles.occRow}>
              <View style={{ flex: 1 }}>
                <Text>
                  {formatDay(o.start_date)} → {formatDay(o.end_date)}
                  {mine ? ' · toi' : ''}
                </Text>
                {o.note ? <Text style={styles.hint}>{o.note}</Text> : null}
              </View>
              {mine ? (
                <Pressable
                  onPress={() => void deleteOcc.mutateAsync(o.id)}
                  disabled={deleteOcc.isPending}
                >
                  <Text style={styles.delete}>Suppr.</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.section}>Enregistrer la présence</Text>
      <TextInput
        style={[
          styles.input,
          { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg },
        ]}
        placeholder="Note (optionnel)"
        placeholderTextColor={placeholderColor}
        value={note}
        onChangeText={setNote}
      />
      <Pressable
        style={[styles.button, !canSave && styles.disabled]}
        disabled={!canSave}
        onPress={() => {
          if (!selectedStart || !selectedEnd) return;
          setFormError(null);
          void createOcc
            .mutateAsync({
              start_date: selectedStart,
              end_date: selectedEnd,
              note: note.trim() || undefined,
            })
            .then(() => {
              setNote('');
              clearSelection();
              setMonth(selectedStart.slice(0, 7));
            })
            .catch((e) =>
              setFormError(e instanceof Error ? e.message : 'create failed'),
            );
        }}
      >
        <Text style={styles.buttonText}>
          {selectedStart && selectedEnd
            ? `Enregistrer ${formatDay(selectedStart)} → ${formatDay(selectedEnd)}`
            : 'Choisis début et fin'}
        </Text>
      </Pressable>
      {formError ? <Text style={styles.err}>{formError}</Text> : null}
      {error ? <Text style={styles.err}>{error.message}</Text> : null}
      {occupations.error instanceof Error ? (
        <Text style={styles.err}>{occupations.error.message}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPad: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  sub: {
    opacity: 0.7,
    lineHeight: 22,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  monthNav: {
    fontSize: 28,
    paddingHorizontal: 12,
  },
  hintCentered: {
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.65,
    fontSize: 13,
  },
  weekHeader: {
    marginTop: 12,
    flexDirection: 'row',
  },
  weekDay: {
    width: '14.2857%',
    textAlign: 'center',
    opacity: 0.55,
    fontSize: 12,
  },
  grid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  dayLabel: {
    fontSize: 13,
  },
  clearBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  clearText: {
    opacity: 0.65,
    fontSize: 13,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    opacity: 0.55,
    fontSize: 12,
    marginTop: 2,
  },
  occRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  delete: {
    color: '#9b1c1c',
    fontSize: 13,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
    textAlign: 'center',
  },
});
