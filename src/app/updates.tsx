import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/loading-view';
import { Text } from '@/components/text';
import { useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { notificationRoute, notificationText } from '@/features/notifications/text';
import { useMyRequests } from '@/features/requests/hooks';
import { t } from '@/i18n';
import { formatDateTime } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

export default function UpdatesScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const myRequests = useMyRequests();
  const markRead = useMarkAllRead();
  const unread = (notifications.data ?? []).some((n) => n.read_at === null);

  // Opening the list counts as reading it.
  const { mutate } = markRead;
  useEffect(() => {
    if (unread) mutate();
  }, [unread, mutate]);

  if (!notifications.data) {
    return (
      <LoadingView
        error={notifications.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => notifications.refetch()}
      />
    );
  }

  const myRequestIds = (myRequests.data ?? []).map((r) => r.id);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={notifications.data}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.list}
        refreshing={notifications.isRefetching}
        onRefresh={() => notifications.refetch()}
        ListEmptyComponent={
          <Text variant="body" muted style={styles.empty}>
            {t('notifications.empty')}
          </Text>
        }
        renderItem={({ item }) => {
          const text = notificationText(item);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(notificationRoute(item, myRequestIds))}
              style={styles.card}
            >
              <View style={styles.top}>
                {item.read_at === null ? <View style={styles.dot} /> : null}
                <Text variant="label" style={styles.title}>
                  {text.title}
                </Text>
              </View>
              <Text variant="body">{text.body}</Text>
              <Text variant="caption" muted>
                {formatDateTime(item.created_at)}
              </Text>
            </Pressable>
          );
        }}
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
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  title: {
    flex: 1,
  },
});
