import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  useTheme,
  type MD3Theme,
} from 'react-native-paper';

/** Seed — teal “port / maison” (not purple). */
export const PORTCLOS_SOURCE = '#0E7C7B';

export type AppTheme = MD3Theme;

export function useAppTheme() {
  return useTheme<AppTheme>();
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function PortclosPaperProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const { theme } = useMaterial3Theme({
    sourceColor: PORTCLOS_SOURCE,
    fallbackSourceColor: PORTCLOS_SOURCE,
  });

  const paperTheme = useMemo(() => {
    const dark = colorScheme === 'dark';
    const base = dark ? MD3DarkTheme : MD3LightTheme;
    const colors = dark ? theme.dark : theme.light;
    return {
      ...base,
      roundness: 16,
      colors: {
        ...base.colors,
        ...colors,
      },
    } satisfies MD3Theme;
  }, [colorScheme, theme.dark, theme.light]);

  return (
    <PaperProvider
      theme={paperTheme}
      settings={{
        icon: ({ name, color, size, ...rest }) => (
          <MaterialCommunityIcons
            name={(name as IconName) ?? 'help-circle-outline'}
            color={color}
            size={size}
            {...rest}
          />
        ),
      }}
    >
      {children}
    </PaperProvider>
  );
}
