import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Pinned at the bottom (main button and a link under it), as in the designs. */
  footer?: ReactNode;
  /** Screens inside the tab bar do not need the bottom safe area. */
  inTabs?: boolean;
  centered?: boolean;
};

/**
 * Standard screen: safe area, scrolls, keeps the focused field above the keyboard,
 * and an optional footer pinned to the bottom.
 * Android draws edge-to-edge, so the window no longer resizes for the keyboard; the
 * padding behaviour makes room instead. iOS adjusts the scroll insets natively.
 */
export function Screen({ children, footer, inTabs, centered }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? ['top'] : ['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'android' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg - 4,
  },
  centered: { justifyContent: 'center' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
});
