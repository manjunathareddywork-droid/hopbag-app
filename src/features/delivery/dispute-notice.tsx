import { InfoBox } from '@/components/info-box';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import type { Dispute } from '@/lib/database.types';
import { colors } from '@/theme';

/** Shown to both people while a dispute is open, and its outcome after. */
export function DisputeNotice({ dispute }: { dispute: Dispute }) {
  const note = dispute.resolution_note ?? '';
  if (dispute.status === 'open') {
    const what = dispute.reason || t(`problem.categories.${dispute.category}`);
    return (
      <InfoBox tone="warning" icon="lock">
        <Text variant="label" style={{ color: colors.peachText }}>
          {t('delivery.underReview', { reason: what })}
        </Text>
        <Text variant="caption" style={{ color: colors.peachText }}>
          {t('delivery.underReviewHelp')}
        </Text>
      </InfoBox>
    );
  }
  return (
    <InfoBox tone="neutral" icon="info">
      {dispute.resolution === 'released'
        ? t('delivery.resolvedReleased', { note })
        : t('delivery.resolvedRefunded', { note })}
    </InfoBox>
  );
}
