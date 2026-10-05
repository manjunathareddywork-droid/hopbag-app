import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { RouteArc } from '@/components/route-line';
import { Text } from '@/components/text';
import { colors, spacing } from '@/theme';

type Props = {
  title: string;
  badge?: string;
  from: string;
  to: string;
  /** e.g. "by 14 Oct" */
  after?: string;
};

/** Teal card at the top of a request: item, status and the route arc. */
export function RequestHero({ title, badge, from, to, after }: Props) {
  return (
    <Card tone="dark" style={styles.card}>
      <View style={styles.row}>
        <Text variant="heading" style={[styles.light, styles.flex]}>
          {title}
        </Text>
        {badge ? <Badge label={badge} tone="orange" /> : null}
      </View>
      <View style={styles.row}>
        <Text variant="body" style={styles.light}>
          {from}
        </Text>
        <RouteArc light />
        <Text variant="body" style={[styles.light, styles.flex]}>
          {after ? `${to} · ${after}` : to}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  flex: { flex: 1 },
  light: { color: colors.white },
});
