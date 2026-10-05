import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import type { Category } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

import { categoryIcon } from '../category-icon';
import { categoryText } from '../labels';

type Props = {
  categories: Category[];
  selected: string;
  onPick: (categoryId: string) => void;
  onSomethingElse: () => void;
};

/** Step 1: allowed categories as big tiles. */
export function CategoryStep({ categories, selected, onPick, onSomethingElse }: Props) {
  return (
    <Screen
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={onSomethingElse}
          style={({ pressed }) => [styles.other, pressed && styles.pressed]}
        >
          <Text variant="label" muted>
            {t('newRequest.somethingElse')}
          </Text>
        </Pressable>
      }
    >
      <ScreenHeader
        title={t('newRequest.step1Title')}
        right={t('common.stepOf', { n: 1, total: 3 })}
      />
      <ProgressBar value={1 / 3} />
      <Text variant="caption" muted>
        {t('newRequest.step1Intro')}
      </Text>
      <View style={styles.grid}>
        {categories.map((c) => {
          const on = c.id === selected;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPick(c.id)}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.pressed]}
            >
              <Icon name={categoryIcon(c.id)} size={26} color={on ? colors.orange : colors.teal} />
              <Text variant="bodyStrong" style={on ? styles.textOn : undefined}>
                {categoryText(c).name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md - 4 },
  tile: {
    width: '48.3%',
    minHeight: 118,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  textOn: { color: colors.white },
  pressed: { opacity: 0.8 },
  other: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
