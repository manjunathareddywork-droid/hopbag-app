import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View style={styles.container}>
        <Text variant="heading">{t('notFound.message')}</Text>
        <Link href="/" style={styles.link}>
          <Text variant="label">{t('notFound.goHome')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  link: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
});
