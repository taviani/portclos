import { View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

import { normalizeBlogTag } from '@/lib/blogTags';
import { BLOG_SUGGESTED_TAGS } from '@/theme/lighthouse';
import { useAppTheme } from '@/theme/paper';

type Props = {
  tags: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onChange: (tags: string[]) => void;
  onInvalid?: (message: string) => void;
};

export function TagPicker({ tags, draft, onDraftChange, onChange, onInvalid }: Props) {
  const theme = useAppTheme();
  const choices = Array.from(new Set([...BLOG_SUGGESTED_TAGS, ...tags]));

  const toggle = (tag: string) => {
    if (tags.includes(tag)) {
      onChange(tags.filter((t) => t !== tag));
      return;
    }
    if (tags.length >= 8) return;
    onChange([...tags, tag]);
  };

  const addCustom = () => {
    const t = normalizeBlogTag(draft);
    if (!t) {
      onInvalid?.('Tag invalide (a-z, 0-9, _-, max 24).');
      return;
    }
    toggle(t);
    onDraftChange('');
  };

  return (
    <View>
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.secondary, letterSpacing: 0.5, marginBottom: 8 }}
      >
        LABELS
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {choices.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <Chip
              key={tag}
              selected={selected}
              onPress={() => toggle(tag)}
              compact
              style={{
                marginRight: 6,
                marginBottom: 6,
                backgroundColor: selected
                  ? theme.colors.secondaryContainer
                  : theme.colors.surfaceVariant,
              }}
              selectedColor={theme.colors.onSecondaryContainer}
            >
              #{tag}
            </Chip>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <TextInput
          mode="outlined"
          dense
          label="Autre label"
          value={draft}
          onChangeText={onDraftChange}
          style={{ flex: 1, backgroundColor: theme.colors.surface }}
          onSubmitEditing={addCustom}
        />
        <Button mode="text" onPress={addCustom} disabled={!draft.trim()}>
          Ajouter
        </Button>
      </View>
    </View>
  );
}
