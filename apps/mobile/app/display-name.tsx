import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { useMe } from '@/hooks/useHouses';
import { useUpdateDisplayName } from '@/hooks/useProfile';
import {
  DISPLAY_NAME_MAX_LEN,
  hasDisplayName,
  normalizeDisplayName,
} from '@/lib/displayName';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export default function DisplayNameScreen() {
  const theme = useAppTheme();
  const { token, ready, signOut } = useSession();
  const me = useMe();
  const updateName = useUpdateDisplayName();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSave = useCallback(async () => {
    const name = normalizeDisplayName(value);
    if (!name) {
      setError(
        value.trim().length > DISPLAY_NAME_MAX_LEN
          ? `80 caractères maximum`
          : 'Choisis un prénom ou un surnom',
      );
      return;
    }
    setError(null);
    try {
      await updateName.mutateAsync(name);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'enregistrement impossible';
      setError(
        raw === 'display_name_required'
          ? 'Choisis un prénom ou un surnom'
          : raw === 'display_name_too_long'
            ? '80 caractères maximum'
            : raw,
      );
    }
  }, [updateName, value]);

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  if (me.isSuccess && me.data && hasDisplayName(me.data)) {
    return <Redirect href="/(tabs)/maison" />;
  }

  if (me.isLoading || (me.isFetching && !me.data)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  const canSave = Boolean(normalizeDisplayName(value)) && !updateName.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text
        variant="displaySmall"
        style={{ color: theme.colors.primary, fontWeight: '800', letterSpacing: -1 }}
      >
        Portclos
      </Text>
      <Text
        variant="headlineSmall"
        style={{
          color: theme.colors.onBackground,
          fontWeight: '700',
          marginTop: 28,
          letterSpacing: -0.3,
        }}
      >
        Comment t’appellent les autres ?
      </Text>
      <Text
        variant="bodyLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          marginTop: 10,
          marginBottom: 28,
          lineHeight: 24,
        }}
      >
        Un prénom ou un surnom suffit. C’est ce que verront les colocataires
        dans la maison.
      </Text>
      <TextInput
        mode="outlined"
        label="Nom d’affichage"
        value={value}
        onChangeText={setValue}
        autoFocus
        maxLength={DISPLAY_NAME_MAX_LEN}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSave) void onSave();
        }}
        style={{ backgroundColor: theme.colors.surface }}
      />
      <Button
        mode="contained"
        onPress={() => void onSave()}
        disabled={!canSave}
        loading={updateName.isPending}
        contentStyle={{ minHeight: 52 }}
        style={{ borderRadius: 16, marginTop: 20 }}
        buttonColor={theme.colors.primary}
      >
        Continuer
      </Button>
      {error ? (
        <Text style={{ color: theme.colors.error, marginTop: 16 }}>{error}</Text>
      ) : null}
      <Button
        mode="text"
        onPress={() => void signOut()}
        style={{ marginTop: 28 }}
        textColor={theme.colors.onSurfaceVariant}
      >
        Se déconnecter
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
