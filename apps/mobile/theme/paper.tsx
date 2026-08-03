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

import { Lighthouse, PORTCLOS_SOURCE } from '@/theme/lighthouse';

export { PORTCLOS_SOURCE, Lighthouse, BLOG_SUGGESTED_TAGS } from '@/theme/lighthouse';

export type AppTheme = MD3Theme;

export function useAppTheme() {
  return useTheme<AppTheme>();
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function lighthouseColors(dark: boolean, generated: MD3Theme['colors']): MD3Theme['colors'] {
  if (dark) {
    return {
      ...generated,
      primary: Lighthouse.beacon,
      onPrimary: Lighthouse.night,
      primaryContainer: Lighthouse.beaconDim,
      onPrimaryContainer: Lighthouse.beaconSoft,
      secondary: Lighthouse.seaFoam,
      onSecondary: Lighthouse.night,
      secondaryContainer: Lighthouse.seaDeep,
      onSecondaryContainer: Lighthouse.seaMist,
      tertiary: Lighthouse.rockSoft,
      background: Lighthouse.night,
      onBackground: Lighthouse.foam,
      surface: Lighthouse.nightMid,
      onSurface: Lighthouse.foam,
      surfaceVariant: Lighthouse.nightVariant,
      onSurfaceVariant: Lighthouse.nightMuted,
      outline: Lighthouse.nightOutline,
      outlineVariant: Lighthouse.nightOutlineVariant,
      elevation: {
        ...generated.elevation,
        level1: Lighthouse.nightLift1,
        level2: Lighthouse.nightLift2,
        level3: Lighthouse.nightLift3,
      },
    };
  }

  return {
    ...generated,
    primary: Lighthouse.sea,
    onPrimary: '#FFFFFF',
    primaryContainer: Lighthouse.seaMist,
    onPrimaryContainer: Lighthouse.seaInk,
    secondary: Lighthouse.beaconDeep,
    onSecondary: Lighthouse.beaconInk,
    secondaryContainer: Lighthouse.beaconSoft,
    onSecondaryContainer: Lighthouse.beaconOnContainer,
    tertiary: Lighthouse.rock,
    background: Lighthouse.mistBg,
    onBackground: Lighthouse.mistInk,
    surface: Lighthouse.mistSurface,
    onSurface: Lighthouse.mistInk,
    surfaceVariant: Lighthouse.mistVariant,
    onSurfaceVariant: Lighthouse.mistMuted,
    outline: Lighthouse.mistOutline,
    outlineVariant: Lighthouse.mistOutlineVariant,
    elevation: {
      ...generated.elevation,
      level1: '#FFFFFF',
      level2: '#F0F7F7',
      level3: '#E6F1F1',
    },
  };
}

export function PortclosPaperProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const { theme } = useMaterial3Theme({
    sourceColor: PORTCLOS_SOURCE,
    fallbackSourceColor: PORTCLOS_SOURCE,
  });

  const paperTheme = useMemo(() => {
    const dark = colorScheme === 'dark';
    const base = dark ? MD3DarkTheme : MD3LightTheme;
    const generated = dark ? theme.dark : theme.light;
    return {
      ...base,
      roundness: 18,
      colors: {
        ...base.colors,
        ...lighthouseColors(dark, generated),
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
