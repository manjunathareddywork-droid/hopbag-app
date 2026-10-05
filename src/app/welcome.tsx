import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

const logo = require('@/assets/brand/logo/hopbag-logo-stacked-ondark.svg');

/** First screen when signed out: teal splash with the stacked logo. */
export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={t('common.appName')}
        />
        <Text variant="body" style={styles.tagline}>
          {t('welcome.tagline')}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button
          title={t('welcome.getStarted')}
          variant="accent"
          onPress={() => router.push('/intro')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.teal },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  logo: { width: 200, height: 210 },
  tagline: { color: colors.textOnDarkMuted, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
