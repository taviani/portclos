import { View } from 'react-native';
import { Chip } from 'react-native-paper';

import type { BlogMention } from '@/lib/api';
import { memberLabel } from '@/lib/memberLabel';
import { useAppTheme } from '@/theme/paper';

type Props = {
  tags?: string[];
  mentions?: BlogMention[];
};

export function PostMetaChips({ tags = [], mentions = [] }: Props) {
  const theme = useAppTheme();
  if (tags.length === 0 && mentions.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
      {tags.map((tag) => (
        <Chip
          key={`tag-${tag}`}
          compact
          style={{
            marginRight: 6,
            marginBottom: 6,
            backgroundColor: theme.colors.secondaryContainer,
          }}
          textStyle={{ color: theme.colors.onSecondaryContainer }}
        >
          #{tag}
        </Chip>
      ))}
      {mentions.map((m) => (
        <Chip
          key={`mention-${m.user_sub}`}
          icon="account"
          compact
          style={{
            marginRight: 6,
            marginBottom: 6,
            backgroundColor: theme.colors.primaryContainer,
          }}
          textStyle={{ color: theme.colors.onPrimaryContainer }}
        >
          @{memberLabel(m)}
        </Chip>
      ))}
    </View>
  );
}
