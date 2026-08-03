import { View } from 'react-native';
import { List } from 'react-native-paper';

import { BeaconRail } from '@/components/brand/BeaconRail';
import { useAppTheme } from '@/theme/paper';

type Props = {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
};

export function MenuRow({ title, subtitle, icon, onPress }: Props) {
  const theme = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
      <BeaconRail style={{ marginRight: 0, borderRadius: theme.roundness }} />
      <List.Item
        title={title}
        description={subtitle}
        onPress={onPress}
        left={(props) => (
          <View style={{ justifyContent: 'center' }}>
            <View
              style={{
                marginLeft: 8,
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.secondaryContainer,
              }}
            >
              <List.Icon
                {...props}
                style={{ margin: 0 }}
                icon={icon}
                color={theme.colors.onSecondaryContainer}
              />
            </View>
          </View>
        )}
        right={(props) => (
          <List.Icon {...props} icon="chevron-right" color={theme.colors.outline} />
        )}
        style={{
          flex: 1,
          backgroundColor: theme.colors.elevation.level1,
          borderTopRightRadius: theme.roundness,
          borderBottomRightRadius: theme.roundness,
          paddingVertical: 8,
        }}
        titleStyle={{
          fontWeight: '700',
          fontSize: 17,
          color: theme.colors.onSurface,
        }}
        descriptionStyle={{
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        }}
        descriptionNumberOfLines={2}
      />
    </View>
  );
}
