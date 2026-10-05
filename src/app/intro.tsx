import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { t, type StringKey } from '@/i18n';
import { colors, fonts, radius, spacing } from '@/theme';

const STEPS: { title: StringKey; body: StringKey }[] = [
  { title: 'intro.step1Title', body: 'intro.step1Body' },
  { title: 'intro.step2Title', body: 'intro.step2Body' },
  { title: 'intro.step3Title', body: 'intro.step3Body' },
];

/** How Hopbag works, in three steps. */
export default function IntroScreen() {
  const router = useRouter();
  const next = () => router.push('/sign-in');
  return (
    <Screen footer={<Button title={t('common.continue')} onPress={next} />}>
      <Pressable accessibilityRole="button" onPress={next} hitSlop={12} style={styles.skip}>
        <Text variant="label" muted>
          {t('common.skip')}
        </Text>
      </Pressable>
      <View style={styles.header}>
        <Text variant="display">{t('intro.title')}</Text>
        <Text variant="body" muted>
          {t('intro.subtitle')}
        </Text>
      </View>
      {STEPS.map((step, i) => (
        <Card key={step.title} style={styles.step}>
          {/* The middle number sits on orange: an accent shape, with teal text. */}
          <View style={[styles.number, i === 1 && styles.numberAccent]}>
            <Text style={[styles.numberText, i === 1 && styles.numberTextAccent]}>{i + 1}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="heading">{t(step.title)}</Text>
            <Text variant="caption" muted>
              {t(step.body)}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skip: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 48,
    height: 48,
    borderRadius: radius.md - 2,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberAccent: { backgroundColor: colors.orange },
  numberText: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  numberTextAccent: { color: colors.teal },
  flex: { flex: 1, gap: 4 },
});
