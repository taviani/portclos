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
import { Text, View } from '@/components/Themed';
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
        <ActivityIndicator />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>Aucune maison sélectionnée</Text>
        <Text style={styles.emptySub}>
          Choisis ou crée une maison dans l’onglet Compte.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push('/(tabs)/me')}>
          <Text style={styles.buttonText}>Ouvrir Compte</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error.message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.role}>Maison courante · {house.role}</Text>
      <View style={styles.menu}>
        <MenuRow
          title="Présences"
          subtitle="Calendrier et occupations"
          onPress={() => router.push('/(tabs)/maison/presences')}
        />
      </View>
      {error ? <Text style={styles.err}>{error.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  role: {
    opacity: 0.55,
    fontSize: 13,
    marginBottom: 8,
  },
  menu: {
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySub: {
    marginTop: 10,
    opacity: 0.7,
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#1a1612',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
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
    color: '#9b1c1c',
  },
});
