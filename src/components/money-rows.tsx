import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './text';

export type MoneyRow = { label: string; value: string; strong?: boolean };

/** Price breakdown with a total line under a divider. */
export function MoneyRows({ rows, total }: { rows: MoneyRow[]; total?: MoneyRow }) {
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text variant="body" muted style={styles.label}>
            {r.label}
          </Text>
          <Text variant={r.strong ? 'bodyStrong' : 'body'}>{r.value}</Text>
        </View>
      ))}
      {total ? (
        <View style={[styles.row, styles.total]}>
          <Text variant="heading" style={styles.label}>
            {total.label}
          </Text>
          <Text variant="heading">{total.value}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
  total: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md - 2,
    marginTop: spacing.xs,
  },
});
