import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';

type Props = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function MenuRow({ title, subtitle, onPress }: Props) {
  const surface = useThemeColor(
    { light: Brand.surface, dark: '#1c1c1e' },
    'background',
  );
  const pressedBg = useThemeColor(
    { light: Brand.surfacePressed, dark: '#2c2c2e' },
    'background',
  );
  const chevron = useThemeColor({ light: Brand.inkMuted, dark: '#8e8e93' }, 'text');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? pressedBg : surface },
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: chevron }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.55,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 26,
    fontWeight: '300',
    marginLeft: 12,
    marginTop: -2,
  },
});
