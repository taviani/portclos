import { View } from 'react-native';
import { ActivityIndicator, Chip, Text } from 'react-native-paper';

import type { HouseMember } from '@/lib/api';
import { useAppTheme } from '@/theme/paper';

type Props = {
  members: HouseMember[];
  selected: string[];
  loading?: boolean;
  onChange: (userSubs: string[]) => void;
};

export function MemberMentionPicker({ members, selected, loading, onChange }: Props) {
  const theme = useAppTheme();

  const toggle = (sub: string) => {
    onChange(
      selected.includes(sub) ? selected.filter((s) => s !== sub) : [...selected, sub],
    );
  };

  return (
    <View>
      <Text
        variant="labelLarge"
        style={{
          color: theme.colors.secondary,
          letterSpacing: 0.5,
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        TAGUER UN MEMBRE
      </Text>
      {loading ? (
        <ActivityIndicator animating color={theme.colors.primary} />
      ) : members.length === 0 ? (
        <Text style={{ color: theme.colors.outline, marginBottom: 8 }}>Aucun membre listé.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {members.map((m) => {
            const on = selected.includes(m.user_sub);
            return (
              <Chip
                key={m.user_sub}
                icon={on ? 'account-check' : 'account-outline'}
                selected={on}
                onPress={() => toggle(m.user_sub)}
                compact
                style={{
                  marginRight: 6,
                  marginBottom: 6,
                  backgroundColor: on
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                }}
              >
                {m.display_name}
              </Chip>
            );
          })}
        </View>
      )}
    </View>
  );
}
