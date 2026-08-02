import { List } from 'react-native-paper';

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
    <List.Item
      title={title}
      description={subtitle}
      onPress={onPress}
      left={(props) => <List.Icon {...props} icon={icon} color={theme.colors.primary} />}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      style={{
        backgroundColor: theme.colors.elevation.level1,
        borderRadius: theme.roundness,
        marginBottom: 10,
        paddingVertical: 6,
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
  );
}
