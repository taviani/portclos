import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';

type Props = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function MenuRow({ title, subtitle, onPress }: Props) {
  const border = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'text');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.55,
  },
  chevron: {
    fontSize: 22,
    opacity: 0.35,
    marginLeft: 12,
  },
});
