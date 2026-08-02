import { useCallback, useLayoutEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router, useNavigation } from 'expo-router';

import { MenuRow } from '@/components/MenuRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View } from '@/components/Themed';
import { Brand } from '@/constants/Brand';
import { useCurrentHouse } from '@/hooks/useHouses';
import { useSession } from '@/providers/SessionProvider';

export default function MaisonHubScreen() {
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
      headerRight: () => (
        <Pressable onPress={openMenu} hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>⋯</Text>
        </Pressable>
      ),
    });
  }, [navigation, house?.name, openMenu]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.ink} />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>Aucune maison</Text>
        <Text style={styles.emptySub}>
          Choisis ou crée une maison dans Compte pour commencer.
        </Text>
        <PrimaryButton
          label="Ouvrir Compte"
          onPress={() => router.push('/(tabs)/me')}
          style={styles.emptyBtn}
        />
        {error ? <Text style={styles.err}>{error.message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>
        {house.role === 'owner' ? 'Propriétaire' : 'Membre'}
      </Text>
      <Text style={styles.heading}>Que veux-tu faire ?</Text>
      <View style={styles.menu}>
        <MenuRow
          title="Présences"
          subtitle="Qui est là, et quand"
          onPress={() => router.push('/(tabs)/maison/presences')}
        />
        <MenuRow
          title="Fermeture"
          subtitle="Checklist avant de partir"
          onPress={() => router.push('/(tabs)/maison/fermeture')}
        />
      </View>
      {error ? <Text style={styles.err}>{error.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  heading: {
    marginTop: 6,
    marginBottom: 22,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  menu: {
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  emptySub: {
    marginTop: 10,
    opacity: 0.65,
    lineHeight: 22,
    fontSize: 16,
  },
  emptyBtn: {
    marginTop: 28,
    alignSelf: 'stretch',
  },
  headerBtn: {
    paddingHorizontal: 8,
  },
  headerBtnText: {
    fontSize: 22,
    fontWeight: '600',
  },
  err: {
    marginTop: 16,
    color: Brand.danger,
  },
});
