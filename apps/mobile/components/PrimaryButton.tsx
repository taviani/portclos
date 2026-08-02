import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Text, useThemeColor } from '@/components/Themed';
import { Brand } from '@/constants/Brand';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'solid' | 'ghost';
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  variant = 'solid',
  style,
}: Props) {
  const solid = variant === 'solid';
  const ghostBorder = useThemeColor({ light: Brand.line, dark: '#444' }, 'text');
  const ghostLabel = useThemeColor({ light: Brand.ink, dark: '#f2f2f2' }, 'text');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base,
        solid
          ? styles.solid
          : [styles.ghost, { borderColor: ghostBorder }],
        (disabled || busy) && styles.disabled,
        pressed && !disabled && !busy && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={solid ? Brand.white : ghostLabel} />
      ) : (
        <Text
          style={[styles.label, solid ? styles.labelSolid : { color: ghostLabel }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: Brand.ink,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelSolid: {
    color: Brand.white,
  },
});
