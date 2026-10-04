import { StyleSheet, View } from 'react-native';

import { t, type StringKey } from '@/i18n';
import type { RequestStatus } from '@/lib/database.types';
import { colors, fonts, radius, spacing } from '@/theme';

import { Text } from './text';

const ENDED: RequestStatus[] = ['cancelled', 'expired', 'refunded'];

export function StatusChip({ status }: { status: RequestStatus }) {
  const ended = ENDED.includes(status);
  return (
    <View style={[styles.chip, ended ? styles.ended : styles.active]}>
      <Text variant="caption" style={styles.text}>
        {t(`status.${status}` as StringKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  active: {
    backgroundColor: colors.chip,
  },
  ended: {
    backgroundColor: colors.chipMuted,
  },
  text: {
    color: colors.text,
    fontFamily: fonts.medium,
  },
});
