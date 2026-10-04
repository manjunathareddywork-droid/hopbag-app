import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useMyProfile } from '@/features/profile/hooks';
import { t } from '@/i18n';
import { spacing } from '@/theme';

const logo = require('@/assets/brand/logo/hopbag-logo-stacked-onlight.svg');

export default function HomeScreen() {
  const { data: profile } = useMyProfile();
  const firstName = profile?.full_name.split(' ')[0] ?? '';

  return (
    <Screen>
      <View style={styles.hero}>
        <Image
          source={logo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={t('common.appName')}
        />
        <Text variant="title">{t('home.greeting', { name: firstName })}</Text>
        <Text variant="body" muted style={styles.tagline}>
          {t('home.tagline')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Link href="/requests/new" asChild>
          <Button title={t('home.newRequest')} />
        </Link>
        <Link href="/requests" asChild>
          <Button title={t('home.myRequests')} variant="secondary" />
        </Link>
        <Link href="/traveler" asChild>
          <Button title={t('home.travel')} variant="secondary" />
        </Link>
        <Link href="/account" asChild>
          <Button title={t('home.account')} variant="secondary" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 130,
    height: 136,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
