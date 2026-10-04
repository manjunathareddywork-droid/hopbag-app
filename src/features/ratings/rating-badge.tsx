import { Text } from '@/components/text';
import { t } from '@/i18n';

import type { RatingSummary } from './api';

/** "★ 4.6 (12 ratings)" or "New on Hopbag". */
export function RatingBadge({ summary }: { summary: RatingSummary | undefined }) {
  return (
    <Text variant="caption" muted>
      {summary && summary.count > 0
        ? t('ratings.summary', {
            average: Number(summary.average).toFixed(1),
            count: summary.count,
          })
        : t('ratings.new')}
    </Text>
  );
}
