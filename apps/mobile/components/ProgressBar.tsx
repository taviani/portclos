import { StyleSheet, View as RNView } from 'react-native';

import { useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';

type Props = {
  value: number;
  total: number;
};

export function ProgressBar({ value, total }: Props) {
  const track = useThemeColor({ light: Brand.line, dark: '#333' }, 'text');
  const pct = total <= 0 ? 0 : Math.min(1, Math.max(0, value / total));

  return (
    <RNView style={[styles.track, { backgroundColor: track }]}>
      <RNView style={[styles.fill, { width: `${pct * 100}%` }]} />
    </RNView>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Brand.ink,
    borderRadius: 99,
  },
});
