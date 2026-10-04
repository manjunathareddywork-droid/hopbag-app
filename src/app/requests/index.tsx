import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { useCities } from '@/features/places/hooks';
import { useMyRequests } from '@/features/requests/hooks';
import { RequestCard } from '@/features/requests/request-card';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

export default function MyRequestsScreen() {
  const requests = useMyRequests();
  const cities = useCities();

  if (!requests.data || !cities.data) {
    const failed = requests.isError || cities.isError;
    return (
      <LoadingView
        error={failed ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => {
          requests.refetch();
          cities.refetch();
        }}
      />
    );
  }

  const newButton = (
    <Link href="/requests/new" asChild>
      <Button title={t('home.newRequest')} />
    </Link>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={requests.data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RequestCard request={item} cities={cities.data} />}
        refreshing={requests.isRefetching}
        onRefresh={() => requests.refetch()}
        ListHeaderComponent={requests.data.length > 0 ? newButton : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" muted style={styles.emptyText}>
              {t('requests.empty')}
            </Text>
            {newButton}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
  },
});
