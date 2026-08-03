import { useCallback, useLayoutEffect } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, View } from 'react-native';
import { type Href, router, useNavigation } from 'expo-router';
import { Appbar, Button, Text, ActivityIndicator } from 'react-native-paper';

import { BeaconBar } from '@/components/brand/BeaconRail';
import { LighthouseMark } from '@/components/LighthouseMark';
import { MenuRow } from '@/components/MenuRow';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export default function MaisonHubScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { signOut } = useSession();
  const { house, isLoading, error } = useCurrentHouse();

  const openMenu = useCallback(() => {
    const changeHouse = () => router.push('/(tabs)/me');
    const logout = () => void signOut();

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Changer de maison', 'Se déconnecter'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) changeHouse();
          if (index === 2) logout();
        },
      );
      return;
    }

    Alert.alert('Maison', undefined, [
      { text: 'Changer de maison', onPress: changeHouse },
      { text: 'Se déconnecter', style: 'destructive', onPress: logout },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [signOut]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: house?.name ?? 'Maison',
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.onBackground,
      headerShadowVisible: false,
      headerRight: () => (
        <Appbar.Action icon="dots-horizontal" onPress={openMenu} accessibilityLabel="Menu" />
      ),
    });
  }, [navigation, house?.name, openMenu, theme.colors.background, theme.colors.onBackground]);

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
          onPress={() => router.push('/(tabs)/me')}
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text
            variant="labelLarge"
            style={{
              color: theme.colors.secondary,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {house.role === 'owner' ? 'Propriétaire' : 'Membre'}
          </Text>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onBackground,
              fontWeight: '800',
              marginTop: 4,
              letterSpacing: -0.4,
            }}
          >
            Que veux-tu faire ?
          </Text>
          <BeaconBar style={{ marginTop: 10 }} />
        </View>
        <LighthouseMark width={72} height={94} glowOpacity={0.55} />
      </View>
      <MenuRow
        title="Blog"
        subtitle="Publier, commenter, réagir"
        icon="newspaper-variant-outline"
        onPress={() => router.push('/(tabs)/maison/blog' as Href)}
      />
      <MenuRow
        title="Présences"
        subtitle="Qui est là, et quand"
        icon="calendar-month"
        onPress={() => router.push('/(tabs)/maison/presences')}
      />
      <MenuRow
        title="Fermeture"
        subtitle="Checklist avant de partir"
        icon="clipboard-check-outline"
        onPress={() => router.push('/(tabs)/maison/fermeture')}
      />
      <MenuRow
        title="Aide"
        subtitle="Jardin, wifi, pompe…"
        icon="help-circle-outline"
        onPress={() => router.push('/(tabs)/maison/aide' as Href)}
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
