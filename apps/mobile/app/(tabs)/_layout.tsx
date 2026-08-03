import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { MaisonHeaderActions } from '@/components/MaisonHeaderActions';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useSession } from '@/providers/SessionProvider';
import { useAppTheme } from '@/theme/paper';

export const unstable_settings = {
  initialRouteName: 'maison',
};

export default function TabLayout() {
  const theme = useAppTheme();
  const { token, ready } = useSession();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator animating color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  const headerRight = () => <MaisonHeaderActions />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onBackground,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
        headerRight,
      }}
    >
      <Tabs.Screen
        name="maison"
        options={{
          title: 'Maison',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'house', android: 'home', web: 'home' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="presences"
        options={{
          title: 'Présences',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: 'Blog',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'newspaper',
                android: 'newspaper',
                web: 'newspaper',
              }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="aide"
        options={{
          title: 'Aide',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'questionmark.circle',
                android: 'help',
                web: 'help',
              }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen name="me" options={{ href: null }} />
    </Tabs>
  );
}
