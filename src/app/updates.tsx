import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import type { IconName } from '@/components/icon';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { notificationRoute, notificationText } from '@/features/notifications/text';
import { useMyRequests } from '@/features/requests/hooks';
import { t } from '@/i18n';
import type { AppNotification, NotificationKind } from '@/lib/database.types';
import { formatAgo } from '@/lib/dates';
import { colors, spacing } from '@/theme';

type Tile = { icon: IconName; tone: 'peach' | 'green' | 'blue' | 'grey' | 'tealTint' };

function tileFor(kind: NotificationKind): Tile {
  switch (kind) {
    case 'offer_received':
    case 'route_request':
      return { icon: 'navigation', tone: 'peach' };
    case 'id_approved':
    case 'ticket_approved':
    case 'completed':
      return { icon: 'shield', tone: 'green' };
    case 'picked_up':
    case 'handed_over':
      return { icon: 'box', tone: 'blue' };
    case 'request_paid':
    case 'payout_unlocked':
    case 'refunded':
      return { icon: 'credit-card', tone: 'grey' };
    case 'message':
      return { icon: 'message-square', tone: 'tealTint' };
    case 'rated':
      return { icon: 'star', tone: 'peach' };
    default:
      return { icon: 'bell', tone: 'grey' };
  }
}

export default function UpdatesScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const myRequests = useMyRequests();
  const markRead = useMarkAllRead();
  // Which ones were new when the screen opened; they stay under "New" after being read.
  const [newIds, setNewIds] = useState<Set<number> | null>(null);
  const data = notifications.data;

  if (data && newIds === null) {
    setNewIds(new Set(data.filter((n) => n.read_at === null).map((n) => n.id)));
  }

  const { mutate } = markRead;
  const unread = (data ?? []).some((n) => n.read_at === null);
  useEffect(() => {
    if (unread) mutate();
  }, [unread, mutate]);

  if (!data) {
    return (
      <LoadingView
        error={notifications.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => notifications.refetch()}
      />
    );
  }

  const myRequestIds = (myRequests.data ?? []).map((r) => r.id);
  const fresh = data.filter((n) => newIds?.has(n.id) || n.read_at === null);
  const earlier = data.filter((n) => !fresh.includes(n));

  const row = (n: AppNotification, isNew: boolean) => {
    const text = notificationText(n);
    const tile = tileFor(n.kind);
    return (
      <Card
        key={n.id}
        style={styles.row}
        onPress={() => router.push(notificationRoute(n, myRequestIds))}
      >
        <IconTile name={tile.icon} tone={tile.tone} size={48} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{text.title}</Text>
          <Text variant="caption" muted>
            {text.body}
          </Text>
          <Text variant="caption" muted>
            {formatAgo(n.created_at)}
          </Text>
        </View>
        {isNew ? (
          <View style={styles.dot} accessibilityLabel={t('notificationsScreen.new')} />
        ) : null}
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={t('notificationsScreen.title')} />
      {data.length === 0 ? (
        <Text variant="body" muted style={styles.empty}>
          {t('notificationsScreen.empty')}
        </Text>
      ) : null}
      {fresh.length > 0 ? (
        <>
          <Text variant="label" muted>
            {t('notificationsScreen.new')}
          </Text>
          {fresh.map((n) => row(n, true))}
        </>
      ) : null}
      {earlier.length > 0 ? (
        <>
          <Text variant="label" muted>
            {t('notificationsScreen.earlier')}
          </Text>
          {earlier.map((n) => row(n, false))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 6 },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
});
