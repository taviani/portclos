import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useCurrentHouse, useMe } from '@/hooks/useHouses';
import {
  monthKey,
  useCreateOccupation,
  useDeleteOccupation,
  useOccupations,
} from '@/hooks/useOccupations';
import { useSession } from '@/providers/SessionProvider';

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

export default function HomeScreen() {
  const inputColor = useThemeColor({}, 'text');
  const inputBorder = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const placeholderColor = useThemeColor({ light: '#888', dark: '#8e8e93' }, 'text');
  const dayOccupiedBg = useThemeColor({ light: '#dceaf5', dark: '#1e3a4f' }, 'background');

  const { token, ready } = useSession();
  const { house, isLoading, error } = useCurrentHouse();
  const me = useMe();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const occupations = useOccupations(house?.id, month);
  const createOcc = useCreateOccupation(house?.id);
  const deleteOcc = useDeleteOccupation(house?.id);

  const today = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const occupiedDays = useMemo(() => {
    const set = new Set<string>();
    for (const o of occupations.data ?? []) {
      const [ys, ms, ds] = o.start_date.split('-').map(Number);
      const [ye, me, de] = o.end_date.split('-').map(Number);
      const cur = new Date(ys, ms - 1, ds);
      const end = new Date(ye, me - 1, de);
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
    const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 Sun
    const startPad = (firstWeekday + 6) % 7; // Mon-first
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Array<{ label: string; key: string | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ label: '', key: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      cells.push({ label: String(d), key });
    }
    return cells;
  }, [month]);

  if (!ready || (token && isLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Portclos</Text>
      {!token || !house ? (
        <Text style={styles.sub}>
          Connecte-toi et choisis / crée une maison dans l’onglet Compte.
        </Text>
      ) : (
        <>
          <Text style={styles.house}>{house.name}</Text>
          <Text style={styles.sub}>Maison courante ({house.role})</Text>

          <View style={styles.monthRow}>
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))}>
              <Text style={styles.monthNav}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))}>
              <Text style={styles.monthNav}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekDay}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {calendarDays.map((cell, i) => {
              const occupied = cell.key ? occupiedDays.has(cell.key) : false;
              return (
                <View
                  key={cell.key ?? `pad-${i}`}
                  style={[
                    styles.dayCell,
                    occupied && { backgroundColor: dayOccupiedBg },
                  ]}
                >
                  <Text style={styles.dayLabel}>{cell.label}</Text>
                </View>
              );
            })}
          </View>

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
                      {o.start_date} → {o.end_date}
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

          <Text style={styles.section}>Ajouter une présence</Text>
          <TextInput
            style={[styles.input, { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg }]}
            placeholder="Début YYYY-MM-DD"
            placeholderTextColor={placeholderColor}
            value={startDate}
            onChangeText={setStartDate}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg }]}
            placeholder="Fin YYYY-MM-DD"
            placeholderTextColor={placeholderColor}
            value={endDate}
            onChangeText={setEndDate}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg }]}
            placeholder="Note (optionnel)"
            placeholderTextColor={placeholderColor}
            value={note}
            onChangeText={setNote}
          />
          <Pressable
            style={[styles.button, createOcc.isPending && styles.disabled]}
            disabled={createOcc.isPending}
            onPress={() => {
              setFormError(null);
              void createOcc
                .mutateAsync({
                  start_date: startDate.trim(),
                  end_date: endDate.trim(),
                  note: note.trim() || undefined,
                })
                .then(() => {
                  setNote('');
                  setMonth(startDate.trim().slice(0, 7) || month);
                })
                .catch((e) =>
                  setFormError(e instanceof Error ? e.message : 'create failed'),
                );
            }}
          >
            <Text style={styles.buttonText}>Enregistrer</Text>
          </Pressable>
          {formError ? <Text style={styles.err}>{formError}</Text> : null}
        </>
      )}
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
    paddingTop: 56,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  house: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
  },
  monthRow: {
    marginTop: 28,
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
  },
  err: {
    marginTop: 16,
    color: '#9b1c1c',
    textAlign: 'center',
  },
});
