import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { type Href, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Appbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentHouse } from '@/hooks/useHouses';
import { searchHouse, type SearchHit } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

type SearchOverlayContextValue = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(null);

export function useSearchOverlay(): SearchOverlayContextValue {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) {
    throw new Error('useSearchOverlay must be used within SearchOverlayProvider');
  }
  return ctx;
}

export function SearchOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [open, openSearch, closeSearch],
  );

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      <SearchOverlay visible={open} onClose={closeSearch} />
    </SearchOverlayContext.Provider>
  );
}

function SearchOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { house } = useCurrentHouse();
  const { token } = useSession();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setQ('');
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setQ(draft.trim()), 280);
    return () => clearTimeout(t);
  }, [draft, visible]);

  const search = useQuery({
    queryKey: queryKeys.search(house?.id ?? '', q),
    enabled: visible && !!token && !!house?.id && q.length >= 2,
    queryFn: async () => {
      if (!token || !house?.id) throw new Error('unauthorized');
      return searchHouse(token, house.id, q);
    },
  });

  const hits = search.data ?? [];
  const hint = useMemo(() => {
    if (!house) return 'Choisis une maison dans Compte.';
    if (q.length < 2) return 'Saisis au moins 2 caractères.';
    if (search.isFetching) return null;
    if (hits.length === 0) return 'Aucun résultat.';
    return null;
  }, [house, q, search.isFetching, hits.length]);

  const goToHit = useCallback(
    (h: SearchHit) => {
      onClose();
      if (h.type === 'help') {
        router.push(`/(tabs)/aide/${h.id}` as Href);
        return;
      }
      if (h.type === 'blog') {
        router.push(`/(tabs)/blog/${h.id}` as Href);
        return;
      }
      if (h.type === 'closing') {
        router.push('/(tabs)/maison/fermeture/modele' as Href);
        return;
      }
      if (h.type === 'occupation') {
        router.push('/(tabs)/presences' as Href);
      }
    },
    [onClose],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: theme.colors.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View
          style={[
            styles.panel,
            {
              paddingTop: insets.top + 8,
              backgroundColor: theme.colors.elevation.level2,
              borderBottomColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
              placeholder="Rechercher…"
              placeholderTextColor={theme.colors.outline}
              value={draft}
              onChangeText={setDraft}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Recherche"
            />
            <Appbar.Action
              icon="close"
              onPress={onClose}
              accessibilityLabel="Fermer la recherche"
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.results}
            contentContainerStyle={styles.resultsContent}
          >
            {search.isFetching ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 12 }} />
            ) : null}
            {hint ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 }}
              >
                {hint}
              </Text>
            ) : null}
            {search.error instanceof Error ? (
              <Text style={{ color: theme.colors.error, textAlign: 'center', marginTop: 12 }}>
                {search.error.message}
              </Text>
            ) : null}
            {hits.map((h) => (
              <Pressable
                key={`${h.type}-${h.id}`}
                style={[styles.hit, { borderBottomColor: theme.colors.outlineVariant }]}
                onPress={() => goToHit(h)}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    color: theme.colors.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {h.type === 'help'
                    ? 'Aide'
                    : h.type === 'closing'
                      ? 'Fermeture'
                      : h.type === 'occupation'
                        ? 'Présences'
                        : 'Blog'}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurface, fontWeight: '700', marginTop: 2 }}
                >
                  {h.title}
                </Text>
                {h.snippet ? (
                  <Text
                    variant="bodySmall"
                    numberOfLines={2}
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 }}
                  >
                    {h.snippet}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  panel: {
    maxHeight: '78%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 17,
  },
  results: {
    marginTop: 4,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  hit: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
