import { Appbar } from 'react-native-paper';
import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { useSearchOverlay } from '@/providers/SearchOverlayProvider';

type Props = {
  showSearch?: boolean;
  showAccount?: boolean;
};

export function MaisonHeaderActions({
  showSearch = true,
  showAccount = true,
}: Props) {
  const { openSearch } = useSearchOverlay();

  return (
    <View style={styles.row}>
      {showSearch ? (
        <Appbar.Action
          icon="magnify"
          onPress={openSearch}
          accessibilityLabel="Recherche"
        />
      ) : null}
      {showAccount ? (
        <Appbar.Action
          icon="account-circle-outline"
          onPress={() => router.push('/compte')}
          accessibilityLabel="Compte"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
