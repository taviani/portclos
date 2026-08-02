import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export default function TabLayout() {
  const theme = useAppTheme();
  const { token, ready } = useSession();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
        },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onBackground,
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="maison"
        options={{
          title: 'Maison',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'house', android: 'home', web: 'home' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person', android: 'person', web: 'person' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
