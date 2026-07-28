import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function MeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compte</Text>
      <Text style={styles.sub}>Connexion OIDC (invite-only) à brancher ensuite.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  sub: {
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
});
