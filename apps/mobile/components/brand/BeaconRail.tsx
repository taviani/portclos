import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Lighthouse } from '@/theme/lighthouse';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Thin amber accent — reuse instead of hardcoding beacon borders per screen. */
export function BeaconRail({ style }: Props) {
  return (
    <View
      style={[
        {
          width: 3,
          borderRadius: 2,
          backgroundColor: Lighthouse.beacon,
          alignSelf: 'stretch',
        },
        style,
      ]}
    />
  );
}

export function BeaconBar({ style }: Props) {
  return (
    <View
      style={[
        {
          height: 3,
          width: 48,
          borderRadius: 2,
          backgroundColor: Lighthouse.beacon,
        },
        style,
      ]}
    />
  );
}
