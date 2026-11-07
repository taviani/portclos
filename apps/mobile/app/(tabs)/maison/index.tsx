import { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Href, router, useNavigation } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button, IconButton, Text, ActivityIndicator } from 'react-native-paper';

import { BeaconBar } from '@/components/brand/BeaconRail';
import { LighthouseMark } from '@/components/LighthouseMark';
import { MenuRow } from '@/components/MenuRow';
import { useCurrentHouse } from '@/hooks/useHouses';
import { monthKey, useOccupations } from '@/hooks/useOccupations';
import { useAppTheme } from '@/theme/paper';

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statutSubtitle(headcount: number | undefined): string {
  if (headcount == null) return 'Statut de la maison';
  if (headcount <= 0) return 'Fermée';
  return `Ouvert : ${headcount} personne${headcount > 1 ? 's' : ''}`;
}

export default function MaisonHubScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { house, isLoading, error } = useCurrentHouse();
  const [copied, setCopied] = useState(false);
  const month = useMemo(() => monthKey(new Date()), []);
  const occupations = useOccupations(house?.id, month);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: house?.name ?? 'Maison',
    });
  }, [navigation, house?.name]);

  const todayHeadcount = useMemo(() => {
    const today = todayKey();
    const load = (occupations.data?.day_loads ?? []).find((d) => d.day === today);
    return load?.headcount ?? 0;
  }, [occupations.data?.day_loads]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '700' }}>
          Aucune maison
        </Text>
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, lineHeight: 24 }}
        >
          Demande une invitation à un propriétaire, ou crée une maison dans Compte.
        </Text>
        <Button
          mode="contained"
          icon="account"
          onPress={() => router.push('/compte')}
          style={styles.cta}
          contentStyle={styles.ctaContent}
        >
          Ouvrir Compte
        </Button>
        {error ? (
          <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error.message}</Text>
        ) : null}
      </View>
    );
  }

  const address = house.address?.trim() ?? '';

  const copyAddress = () => {
    if (!address) return;
    void (async () => {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    })();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onBackground,
              fontWeight: '800',
              letterSpacing: -0.4,
            }}
          >
            {house.name}
          </Text>
          {address ? (
            <View style={styles.addressRow}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  lineHeight: 22,
                  flex: 1,
                }}
              >
                {address}
              </Text>
              <IconButton
                icon={copied ? 'check' : 'content-copy'}
                size={18}
                iconColor={copied ? theme.colors.primary : theme.colors.onSurfaceVariant}
                accessibilityLabel={copied ? 'Adresse copiée' : 'Copier l’adresse'}
                onPress={copyAddress}
                style={styles.copyBtn}
              />
            </View>
          ) : house.role === 'owner' ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.outline,
                marginTop: 8,
                lineHeight: 20,
              }}
              onPress={() => router.push('/(tabs)/maison/infos' as Href)}
            >
              Ajouter l’adresse
            </Text>
          ) : null}
          <BeaconBar style={{ marginTop: 12 }} />
        </View>
        <LighthouseMark width={72} height={94} glowOpacity={0.55} />
      </View>
      <MenuRow
        title="Réglages"
        subtitle="Adresse et capacité"
        icon="cog-outline"
        onPress={() => router.push('/(tabs)/maison/infos' as Href)}
      />
      <MenuRow
        title="Fermeture"
        subtitle="Checklist avant de partir"
        icon="clipboard-check-outline"
        onPress={() => router.push('/(tabs)/maison/fermeture' as Href)}
      />
      <MenuRow
        title="Statut"
        subtitle={
          occupations.isLoading ? 'Chargement…' : statutSubtitle(todayHeadcount)
        }
        icon="format-color-fill"
        onPress={() => router.push('/(tabs)/presences' as Href)}
      />
      <MenuRow
        title="Inventaire"
        subtitle="Présents et courses prioritaires"
        icon="clipboard-list-outline"
        onPress={() => router.push('/(tabs)/maison/inventaire' as Href)}
      />
      <MenuRow
        title="Chantier"
        subtitle="Travaux et projets"
        icon="hammer-wrench"
        onPress={() => router.push('/(tabs)/maison/chantier' as Href)}
      />
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error.message}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 18,
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 0,
  },
  copyBtn: {
    margin: 0,
    marginTop: -6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: 28,
    borderRadius: 14,
  },
  ctaContent: {
    minHeight: 52,
  },
});
