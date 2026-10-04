import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useServerHealth } from '@/hooks/use-server-health';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

const logo = require('@/assets/brand/logo/hopbag-logo-stacked-onlight.svg');

export default function HomeScreen() {
  const health = useServerHealth();

  const status = health.isPending
    ? { text: t('home.serverChecking'), color: colors.textMuted }
    : health.isError
      ? { text: t('home.serverError'), color: colors.danger }
      : { text: t('home.serverOk'), color: colors.success };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={t('common.appName')}
        />
        <Text variant="heading" style={styles.tagline}>
          {t('home.tagline')}
        </Text>
      </View>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: status.color }]} />
        <Text variant="caption" muted>
          {status.text}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  logo: {
    width: 163,
    height: 171,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 320,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
