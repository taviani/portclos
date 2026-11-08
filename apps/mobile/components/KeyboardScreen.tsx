import { forwardRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /** Extra offset under a stack header (default matches Portclos stack screens). */
  keyboardVerticalOffset?: number;
};

/**
 * Scrollable screen that keeps focused inputs above the iOS keyboard.
 * Prefer this over a bare ScrollView whenever the screen has TextInput.
 */
export const KeyboardScreen = forwardRef<ScrollView, Props>(function KeyboardScreen(
  {
    children,
    style,
    contentContainerStyle,
    keyboardVerticalOffset = Platform.OS === 'ios' ? 88 : 0,
  },
  ref,
) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        ref={ref}
        style={styles.flex}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
