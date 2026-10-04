import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { t, type StringKey } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

const REASONS = [
  'medicine',
  'alcohol',
  'tobacco',
  'valuables',
  'batteries',
  'weapons',
  'flammable',
  'drugs',
  'animals',
] as const;

export default function NotAllowedScreen() {
  return (
    <Screen>
      <Text variant="body">{t('notAllowed.intro')}</Text>
      <View style={styles.list}>
        {REASONS.map((code) => (
          <View key={code} style={styles.item}>
            <View style={styles.bullet} />
            <Text variant="body" style={styles.text}>
              {t(`blockedReasons.${code}` as StringKey)}
            </Text>
          </View>
        ))}
        <View style={styles.item}>
          <View style={styles.bullet} />
          <Text variant="body" style={styles.text}>
            {t('notAllowed.sealed')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: colors.accent,
  },
  text: {
    flex: 1,
  },
});
