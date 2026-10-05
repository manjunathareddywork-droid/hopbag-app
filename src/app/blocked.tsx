import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useProfilesByIds } from '@/features/profile/hooks';
import { useMyBlocks, useUnblock } from '@/features/safety/hooks';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

export default function BlockedScreen() {
  const blocks = useMyBlocks();
  const people = useProfilesByIds(blocks.data ?? []);
  const unblock = useUnblock();

  if (!blocks.data) {
    return (
      <LoadingView
        error={blocks.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => blocks.refetch()}
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('safety.blockedListTitle')} />
      {blocks.data.length === 0 ? (
        <Text variant="body" muted>
          {t('safety.blockedListEmpty')}
        </Text>
      ) : (
        blocks.data.map((id) => (
          <View key={id} style={styles.row}>
            <Text variant="body" style={styles.name}>
              {people.data?.find((p) => p.id === id)?.full_name ?? ''}
            </Text>
            <Button
              title={t('safety.unblock')}
              variant="secondary"
              disabled={unblock.isPending}
              onPress={() => unblock.mutate(id)}
            />
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  name: {
    flex: 1,
  },
});
