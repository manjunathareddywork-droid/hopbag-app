import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/** Placeholder legal text, clearly marked as a draft until the lawyer signs off. */
export function LegalPage({ body }: { body: string }) {
  return (
    <Screen>
      <View style={styles.notice}>
        <Text variant="label">{t('legal.draftNotice')}</Text>
      </View>
      <Text variant="body">{body}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
