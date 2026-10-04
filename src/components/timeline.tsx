import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export type TimelineStep = {
  title: string;
  detail?: string;
  state: 'done' | 'current' | 'todo';
};

/** Delivery steps: green tick, orange ring for now, grey ring for later. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View style={styles.list}>
      {steps.map((s, i) => (
        <View key={i} style={styles.row}>
          <View
            style={[
              styles.mark,
              s.state === 'done' && styles.done,
              s.state === 'current' && styles.current,
            ]}
          >
            {s.state === 'done' ? <Icon name="check" size={16} color={colors.white} /> : null}
          </View>
          <View style={styles.text}>
            <Text variant="bodyStrong" style={s.state === 'todo' ? styles.todoText : undefined}>
              {s.title}
            </Text>
            {s.detail ? (
              <Text variant="caption" muted>
                {s.detail}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md + 2 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#94A7AB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  done: { backgroundColor: colors.success, borderColor: colors.success },
  current: { borderColor: colors.orange },
  text: { flex: 1, gap: 2 },
  todoText: { color: colors.textMuted },
});
