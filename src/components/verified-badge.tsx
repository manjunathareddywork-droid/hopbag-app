import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

/** Teal pill with an orange check mark (orange as a shape only, per brand rules). */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityLabel={t('badge.verified')}>
      <View style={styles.check}>
        <Text style={styles.tick}>✓</Text>
      </View>
      <Text variant="caption" style={styles.text}>
        {t('badge.verified')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    backgroundColor: colors.teal,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    color: colors.teal,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  text: {
    color: colors.textOnDark,
    fontFamily: fonts.medium,
  },
});
