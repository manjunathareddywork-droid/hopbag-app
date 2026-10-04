import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { t } from '@/i18n';
import type { Dispute } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

/** Shown to both people while a dispute is open, and its outcome after. */
export function DisputeNotice({ dispute }: { dispute: Dispute }) {
  const note = dispute.resolution_note ?? '';
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      {dispute.status === 'open' ? (
        <>
          <Text variant="label">{t('delivery.underReview', { reason: dispute.reason })}</Text>
          <Text variant="caption" muted>
            {t('delivery.underReviewHelp')}
          </Text>
        </>
      ) : (
        <Text variant="body">
          {dispute.resolution === 'released'
            ? t('delivery.resolvedReleased', { note })
            : t('delivery.resolvedRefunded', { note })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
