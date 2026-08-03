import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useCurrentHouse, useMe, useUpdateHouse } from '@/hooks/useHouses';
import {
  monthKey,
  useCreateOccupation,
  useDeleteOccupation,
  useOccupations,
  useUpdateOccupation,
} from '@/hooks/useOccupations';
import {
  GUEST_RELATION_LABELS,
  guestSleepLabel,
  guestsForEditForm,
  type GuestRelation,
  type Occupation,
  type OccupationGuest,
} from '@/lib/api';

const RELATION_OPTIONS: GuestRelation[] = ['ami', 'conjoint', 'enfant', 'famille', 'autre'];

function bedsLabel(singles: number, doubles: number): string {
  const parts: string[] = [];
  if (singles > 0) parts.push(`${singles} lit${singles > 1 ? 's' : ''} simple${singles > 1 ? 's' : ''}`);
  if (doubles > 0) parts.push(`${doubles} lit${doubles > 1 ? 's' : ''} double${doubles > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

/** Set guest idx sleeping: alone, with host, or with another guest (mutual). */
function applyGuestShare(
  guests: OccupationGuest[],
  idx: number,
  partner: 'alone' | 'host' | number,
): OccupationGuest[] {
  const next = guests.map((g) => ({ ...g }));
  const clearShareWith = (i: number) => {
    const sw = next[i].share_with;
    if (sw === 'host' || !sw) return;
    if (sw.startsWith('guest:')) {
      const j = Number(sw.slice(6));
      if (Number.isInteger(j) && next[j] && next[j].share_with === `guest:${i}`) {
        next[j] = { ...next[j], room: 'alone', share_with: '' };
      }
    }
  };

  clearShareWith(idx);

  // If someone else was sharing with host and we take host, free them
  if (partner === 'host') {
    for (let i = 0; i < next.length; i++) {
      if (i !== idx && next[i].room === 'shared' && next[i].share_with === 'host') {
        next[i] = { ...next[i], room: 'alone', share_with: '' };
      }
    }
    next[idx] = { ...next[idx], room: 'shared', share_with: 'host' };
    return next;
  }

  if (partner === 'alone') {
    next[idx] = { ...next[idx], room: 'alone', share_with: '' };
    return next;
  }

  // partner is guest index
  const j = partner;
  if (j < 0 || j >= next.length || j === idx) {
    next[idx] = { ...next[idx], room: 'alone', share_with: '' };
    return next;
  }
  clearShareWith(j);
  // Break previous host share on j
  if (next[j].share_with === 'host') {
    next[j] = { ...next[j], room: 'alone', share_with: '' };
  }
  next[idx] = { ...next[idx], room: 'shared', share_with: `guest:${j}` };
  next[j] = { ...next[j], room: 'shared', share_with: `guest:${idx}` };
  return next;
}

function removeGuestAt(guests: OccupationGuest[], idx: number): OccupationGuest[] {
  const mapOld = (old: number) => {
    if (old === idx) return -1;
    return old > idx ? old - 1 : old;
  };
  return guests
    .filter((_, i) => i !== idx)
    .map((g) => {
      if (g.room !== 'shared') {
        return { ...g, room: 'alone' as const, share_with: '' };
      }
      if (g.share_with === 'host') return g;
      if (g.share_with?.startsWith('guest:')) {
        const oldPartner = Number(g.share_with.slice(6));
        const newPartner = mapOld(oldPartner);
        if (newPartner < 0) {
          return { ...g, room: 'alone' as const, share_with: '' };
        }
        return { ...g, share_with: `guest:${newPartner}` };
      }
      return g;
    });
}

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

function emptyGuest(): OccupationGuest {
  return { first_name: '', relation: 'ami', room: 'alone', share_with: '' };
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
  const warnBg = useThemeColor({ light: '#f5e6c8', dark: '#3d3218' }, 'background');
  const overBg = useThemeColor({ light: '#f0d4d4', dark: '#3d1e1e' }, 'background');
  const screenBg = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);

  const scrollFormIntoView = useCallback(() => {
    const run = () => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formY.current - 16),
        animated: true,
      });
    };
    requestAnimationFrame(() => {
      setTimeout(run, Platform.OS === 'ios' ? 80 : 0);
    });
  }, []);

  const { house, isLoading, error } = useCurrentHouse();
  const me = useMe();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const occupations = useOccupations(house?.id, month);
  const createOcc = useCreateOccupation(house?.id);
  const updateOcc = useUpdateOccupation(house?.id);
  const deleteOcc = useDeleteOccupation(house?.id);
  const updateHouse = useUpdateHouse(house?.id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [guests, setGuests] = useState<OccupationGuest[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [singleBedsDraft, setSingleBedsDraft] = useState('');
  const [doubleBedsDraft, setDoubleBedsDraft] = useState('');
  const [showCapacityEdit, setShowCapacityEdit] = useState(false);
  const [capacityWarnText, setCapacityWarnText] = useState<string | null>(null);

  const singleBeds = occupations.data?.single_beds ?? house?.single_beds ?? 0;
  const doubleBeds = occupations.data?.double_beds ?? house?.double_beds ?? 0;
  const roomsAvailable = singleBeds + doubleBeds;
  const guestHeadcount =
    1 + guests.filter((g) => g.first_name.trim().length > 0).length;
  const dayLoadMap = useMemo(() => {
    const map = new Map<string, { headcount: number; over: boolean }>();
    for (const d of occupations.data?.day_loads ?? []) {
      map.set(d.day, { headcount: d.headcount, over: d.over_capacity });
    }
    return map;
  }, [occupations.data?.day_loads]);

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

  const resetForm = useCallback(() => {
    setEditingId(null);
    setNote('');
    setGuests([]);
    clearSelection();
    setCapacityWarnText(null);
  }, [clearSelection]);

  const startEdit = useCallback(
    (o: Occupation) => {
      setEditingId(o.id);
      setRangeStart(o.start_date);
      setRangeEnd(o.end_date);
      setNote(o.note ?? '');
      setGuests(guestsForEditForm(o.guests ?? []));
      setFormError(null);
      setCapacityWarnText(null);
      setMonth(o.start_date.slice(0, 7));
      scrollFormIntoView();
    },
    [scrollFormIntoView],
  );

  const confirmDelete = useCallback(
    (occupationId: string) => {
      Alert.alert('Supprimer cette présence ?', undefined, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deleteOcc.mutateAsync(occupationId).then(() => {
              if (editingId === occupationId) resetForm();
            });
          },
        },
      ]);
    },
    [deleteOcc, editingId, resetForm],
  );

  const occupiedDays = useMemo(() => {
    const set = new Set<string>();
    for (const o of occupations.data?.occupations ?? []) {
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
  }, [occupations.data?.occupations, month]);

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

  const savePresence = useCallback(() => {
    if (!selectedStart || !selectedEnd) return;
    const cleaned = guests
      .map((g, i) => {
        const room = g.room === 'shared' ? 'shared' : 'alone';
        let share_with = '';
        if (room === 'shared') {
          share_with = g.share_with || 'host';
        }
        return {
          first_name: g.first_name.trim(),
          relation: g.relation || 'autre',
          room,
          share_with,
          _i: i,
        };
      })
      .filter((g) => g.first_name.length > 0);
    const indexMap = new Map(cleaned.map((g, newI) => [g._i, newI]));
    const payload = cleaned.map(({ first_name, relation, room, share_with }) => {
      let sw = share_with;
      if (sw.startsWith('guest:')) {
        const oldJ = Number(sw.slice(6));
        const newJ = indexMap.get(oldJ);
        if (newJ === undefined) {
          return { first_name, relation, room: 'alone' as const, share_with: '' };
        }
        sw = `guest:${newJ}`;
      }
      return { first_name, relation, room, share_with: sw };
    });
    setFormError(null);
    const body = {
      start_date: selectedStart,
      end_date: selectedEnd,
      note: note.trim() || undefined,
      guests: payload,
    };
    const req = editingId
      ? updateOcc.mutateAsync({ occupationId: editingId, ...body })
      : createOcc.mutateAsync(body);
    void req
      .then((res) => {
        resetForm();
        setMonth(selectedStart.slice(0, 7));
        if (res.capacity_warning) {
          const w = res.capacity_warning;
          const msg =
            w.detail?.trim() ||
            `Le ${formatDay(w.max_day)} : ${w.people ?? w.headcount} pers. / ${w.rooms_used} chambre(s) pour ${w.rooms_available} dispo. Présence enregistrée.`;
          setCapacityWarnText(msg);
          Alert.alert('Capacité dépassée', msg);
        }
      })
      .catch((e) => {
        const raw = e instanceof Error ? e.message : 'create failed';
        if (raw.includes('too_many_host_shares') || raw.includes('too_many_double_shares')) {
          setFormError('Un seul invité peut partager ton lit double.');
          return;
        }
        if (raw.includes('invalid_guest_pair')) {
          setFormError('Le partage de chambre entre invités est incomplet.');
          return;
        }
        setFormError(raw);
      });
  }, [
    selectedStart,
    selectedEnd,
    guests,
    note,
    editingId,
    createOcc,
    updateOcc,
    resetForm,
  ]);

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
        <Pressable style={styles.button} onPress={() => router.push('/compte')}>
          <Text style={styles.buttonText}>Ouvrir Compte</Text>
        </Pressable>
      </View>
    );
  }

  const canSave =
    !!selectedStart &&
    !!selectedEnd &&
    !createOcc.isPending &&
    !updateOcc.isPending;
  const list = occupations.data?.occupations ?? [];
  const saving = createOcc.isPending || updateOcc.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: screenBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))}>
          <Text style={styles.monthNav}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))}>
          <Text style={styles.monthNav}>›</Text>
        </Pressable>
      </View>

      {roomsAvailable > 0 ? (
        <Text style={styles.capacityLine}>{bedsLabel(singleBeds, doubleBeds)}</Text>
      ) : house.role === 'owner' ? (
        <Text style={styles.capacityLine}>Chambres non configurées</Text>
      ) : null}

      {house.role === 'owner' ? (
        showCapacityEdit ? (
          <RNView style={styles.capacityEditCol}>
            <RNView style={styles.capacityEdit}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: inputColor,
                    borderColor: inputBorder,
                    backgroundColor: inputBg,
                    flex: 1,
                  },
                ]}
                keyboardType="number-pad"
                placeholder="Lits simples"
                placeholderTextColor={placeholderColor}
                value={singleBedsDraft}
                onChangeText={setSingleBedsDraft}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    color: inputColor,
                    borderColor: inputBorder,
                    backgroundColor: inputBg,
                    flex: 1,
                  },
                ]}
                keyboardType="number-pad"
                placeholder="Lits doubles"
                placeholderTextColor={placeholderColor}
                value={doubleBedsDraft}
                onChangeText={setDoubleBedsDraft}
              />
            </RNView>
            <RNView style={styles.capacityEdit}>
              <Pressable
                style={styles.smallBtn}
                disabled={updateHouse.isPending}
                onPress={() => {
                  const s = parseInt(singleBedsDraft, 10);
                  const d = parseInt(doubleBedsDraft, 10);
                  if (Number.isNaN(s) || s < 0 || Number.isNaN(d) || d < 0) {
                    setFormError('Nombre de lits invalide');
                    return;
                  }
                  void updateHouse
                    .mutateAsync({ single_beds: s, double_beds: d })
                    .then(() => {
                      setShowCapacityEdit(false);
                      setSingleBedsDraft('');
                      setDoubleBedsDraft('');
                    })
                    .catch((e) =>
                      setFormError(e instanceof Error ? e.message : 'update failed'),
                    );
                }}
              >
                <Text style={styles.smallBtnText}>OK</Text>
              </Pressable>
              <Pressable onPress={() => setShowCapacityEdit(false)}>
                <Text style={styles.clearText}>Annuler</Text>
              </Pressable>
            </RNView>
          </RNView>
        ) : (
          <Pressable
            onPress={() => {
              setSingleBedsDraft(String(singleBeds));
              setDoubleBedsDraft(String(doubleBeds));
              setShowCapacityEdit(true);
            }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearText}>
              {roomsAvailable > 0 ? 'Modifier les chambres' : 'Définir les chambres'}
            </Text>
          </Pressable>
        )
      ) : null}

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
          const loadInfo = dayLoadMap.get(cell.key);
          const load = loadInfo?.headcount ?? 0;
          const over = loadInfo?.over ?? false;
          const nearFull =
            roomsAvailable > 0 && !over && load > 0 && load >= roomsAvailable;
          return (
            <Pressable
              key={cell.key}
              onPress={() => onDayPress(cell.key!)}
              style={[
                styles.dayCell,
                occupied && !inSel && { backgroundColor: dayOccupiedBg },
                nearFull && !over && !inSel && { backgroundColor: warnBg },
                over && !inSel && { backgroundColor: overBg },
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
              {load > 0 && roomsAvailable > 0 ? (
                <Text
                  style={[
                    styles.loadDot,
                    isEndpoint && { color: endpointFg },
                    over && !isEndpoint && { color: '#9b1c1c' },
                  ]}
                >
                  {load}
                </Text>
              ) : null}
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
      ) : list.length === 0 ? (
        <Text style={styles.hint}>Aucune occupation ce mois-ci.</Text>
      ) : (
        list.map((o) => {
          const mine = o.user_sub === me.data?.sub;
          const guestLabel =
            (o.guests?.length ?? 0) > 0
              ? ` · ${o.headcount} pers. (${o.guests
                  .map((g) => `${g.first_name}${guestSleepLabel(g, o.guests)}`)
                  .join(', ')})`
              : o.headcount > 1
                ? ` · ${o.headcount} pers.`
                : '';
          return (
            <View key={o.id} style={styles.occRow}>
              <View style={{ flex: 1 }}>
                <Text>
                  {formatDay(o.start_date)} → {formatDay(o.end_date)}
                  {mine ? ' · toi' : ''}
                  {guestLabel}
                </Text>
                {o.note ? <Text style={styles.hint}>{o.note}</Text> : null}
              </View>
              {mine ? (
                <RNView style={styles.occActions}>
                  <Pressable
                    onPress={() => startEdit(o)}
                    disabled={saving}
                    style={styles.occActionBtn}
                  >
                    <Text style={styles.editLink}>
                      {editingId === o.id ? 'En cours…' : 'Modifier'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(o.id)}
                    disabled={deleteOcc.isPending || saving}
                    style={styles.occActionBtn}
                  >
                    <Text style={styles.delete}>Suppr.</Text>
                  </Pressable>
                </RNView>
              ) : null}
            </View>
          );
        })
      )}

      <RNView
        onLayout={(e) => {
          formY.current = e.nativeEvent.layout.y;
        }}
      >
      <Text style={styles.section}>
        {editingId ? 'Modifier la présence' : 'Enregistrer la présence'}
      </Text>
      {editingId ? (
        <Pressable onPress={resetForm} style={styles.clearBtn}>
          <Text style={styles.clearText}>Annuler la modification</Text>
        </Pressable>
      ) : null}
      <TextInput
        style={[
          styles.input,
          { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg },
        ]}
        placeholder="Note (optionnel)"
        placeholderTextColor={placeholderColor}
        value={note}
        onChangeText={setNote}
        onFocus={scrollFormIntoView}
      />

      <Text style={styles.guestTitle}>
        Invités (optionnel) · total {guestHeadcount} pers.
      </Text>
      <Text style={styles.guestHint}>Précise le couchage de chaque invité.</Text>
      {guests.map((g, idx) => {
        const isAlone = (g.room || 'alone') !== 'shared';
        const withHost = g.room === 'shared' && g.share_with === 'host';
        const withGuestIdx =
          g.room === 'shared' && g.share_with?.startsWith('guest:')
            ? Number(g.share_with.slice(6))
            : null;
        return (
          <RNView key={`g-${idx}`} style={styles.guestRow}>
            <TextInput
              style={[
                styles.input,
                styles.guestName,
                { color: inputColor, borderColor: inputBorder, backgroundColor: inputBg },
              ]}
              placeholder="Prénom"
              placeholderTextColor={placeholderColor}
              value={g.first_name}
              onChangeText={(t) => {
                setGuests((prev) =>
                  prev.map((x, i) => (i === idx ? { ...x, first_name: t } : x)),
                );
              }}
              onFocus={scrollFormIntoView}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relScroll} keyboardShouldPersistTaps="handled">
              {RELATION_OPTIONS.map((rel) => {
                const active = g.relation === rel;
                return (
                  <Pressable
                    key={rel}
                    onPress={() =>
                      setGuests((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, relation: rel } : x)),
                      )
                    }
                    style={[styles.relChip, active && styles.relChipActive]}
                  >
                    <Text style={[styles.relChipText, active && styles.relChipTextActive]}>
                      {GUEST_RELATION_LABELS[rel]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.sleepLabel}>Couchage</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relScroll} keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => setGuests((prev) => applyGuestShare(prev, idx, 'alone'))}
                style={[styles.relChip, isAlone && styles.roomChipActive]}
              >
                <Text style={[styles.relChipText, isAlone && styles.relChipTextActive]}>
                  Chambre seule
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setGuests((prev) => applyGuestShare(prev, idx, 'host'))}
                style={[styles.relChip, withHost && styles.roomChipActive]}
              >
                <Text style={[styles.relChipText, withHost && styles.relChipTextActive]}>
                  Lit double avec moi
                </Text>
              </Pressable>
              {guests.map((other, j) => {
                if (j === idx) return null;
                const label = other.first_name.trim() || `Invité ${j + 1}`;
                const active = withGuestIdx === j;
                return (
                  <Pressable
                    key={`share-${j}`}
                    onPress={() => setGuests((prev) => applyGuestShare(prev, idx, j))}
                    style={[styles.relChip, active && styles.roomChipActive]}
                  >
                    <Text style={[styles.relChipText, active && styles.relChipTextActive]}>
                      Lit double avec {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setGuests((prev) => removeGuestAt(prev, idx))}>
              <Text style={styles.delete}>Retirer</Text>
            </Pressable>
          </RNView>
        );
      })}
      <Pressable
        onPress={() => {
          setGuests((prev) => [...prev, emptyGuest()]);
          scrollFormIntoView();
        }}
        style={styles.clearBtn}
      >
        <Text style={styles.clearText}>+ Ajouter un invité</Text>
      </Pressable>

      <Pressable
        style={[styles.button, !canSave && styles.disabled]}
        disabled={!canSave}
        onPress={savePresence}
      >
        <Text style={styles.buttonText}>
          {!selectedStart || !selectedEnd
            ? 'Choisis début et fin'
            : editingId
              ? `Mettre à jour ${formatDay(selectedStart)} → ${formatDay(selectedEnd)}`
              : `Enregistrer ${formatDay(selectedStart)} → ${formatDay(selectedEnd)}`}
        </Text>
      </Pressable>
      {formError ? <Text style={styles.err}>{formError}</Text> : null}
      {capacityWarnText ? <Text style={styles.warn}>{capacityWarnText}</Text> : null}
      {error ? <Text style={styles.err}>{error.message}</Text> : null}
      {occupations.error instanceof Error ? (
        <Text style={styles.err}>{occupations.error.message}</Text>
      ) : null}
      </RNView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
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
  capacityLine: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.7,
  },
  capacityEdit: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capacityEditCol: {
    marginTop: 4,
    gap: 4,
  },
  smallBtn: {
    backgroundColor: '#1a1612',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  smallBtnText: {
    color: '#fff',
    fontWeight: '600',
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
  loadDot: {
    fontSize: 9,
    opacity: 0.7,
    marginTop: 1,
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
  guestTitle: {
    marginTop: 16,
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 14,
  },
  guestHint: {
    opacity: 0.55,
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 17,
  },
  sleepLabel: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 2,
  },
  guestRow: {
    marginBottom: 10,
    gap: 6,
  },
  guestName: {
    marginTop: 0,
  },
  relScroll: {
    flexGrow: 0,
  },
  relChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  relChipActive: {
    backgroundColor: '#1a1612',
    borderColor: '#1a1612',
  },
  roomChipActive: {
    backgroundColor: '#2c4a3e',
    borderColor: '#2c4a3e',
  },
  relChipText: {
    fontSize: 12,
  },
  relChipTextActive: {
    color: '#fff',
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
  occActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  occActionBtn: {
    paddingVertical: 4,
  },
  editLink: {
    color: '#1a1612',
    fontSize: 13,
    fontWeight: '600',
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
  warn: {
    marginTop: 16,
    color: '#8a6a1a',
    textAlign: 'center',
    lineHeight: 20,
  },
});
