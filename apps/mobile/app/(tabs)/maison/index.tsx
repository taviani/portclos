import { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Href, router, useNavigation } from 'expo-router';
import { Button, Text, ActivityIndicator } from 'react-native-paper';

import { BeaconBar } from '@/components/brand/BeaconRail';
import { LighthouseMark } from '@/components/LighthouseMark';
import { MenuRow } from '@/components/MenuRow';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useAppTheme } from '@/theme/paper';

export default function MaisonHubScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { house, isLoading, error } = useCurrentHouse();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: house?.name ?? 'Maison',
    });
  }, [navigation, house?.name]);

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
          Choisis ou crée une maison dans Compte pour commencer.
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
            <Text
              variant="bodyLarge"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              {address}
            </Text>
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
        title="Infos"
        subtitle="Adresse et capacité"
        icon="home-city-outline"
        onPress={() => router.push('/(tabs)/maison/infos' as Href)}
      />
      <MenuRow
        title="Fermeture"
        subtitle="Checklist avant de partir"
        icon="clipboard-check-outline"
        onPress={() => router.push('/(tabs)/maison/fermeture' as Href)}
      />
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error.message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 18,
    gap: 8,
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
