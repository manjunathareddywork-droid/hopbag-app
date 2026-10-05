import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { LoadingView } from '@/components/loading-view';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSession } from '@/features/auth/session';
import { useRecentMessages } from '@/features/chat/hooks';
import { useNotifications } from '@/features/notifications/hooks';
import { useOffersForRequests, useRequestsByIds } from '@/features/offers/hooks';
import { useProfilesByIds } from '@/features/profile/hooks';
import { t } from '@/i18n';
import type { Message } from '@/lib/database.types';
import { formatWhen } from '@/lib/dates';
import { colors, fonts, spacing } from '@/theme';

/** One row per conversation (request), newest first. */
export default function MessagesScreen() {
  const router = useRouter();
  const me = useSession().session?.user.id;
  const recent = useRecentMessages();
  const notifications = useNotifications().data ?? [];

  // Messages come newest first; keep the first one seen for each request.
  const latest = new Map<string, Message>();
  for (const m of recent.data ?? []) if (!latest.has(m.request_id)) latest.set(m.request_id, m);
  const ids = [...latest.keys()];
  const requests = useRequestsByIds(ids).data ?? [];
  const offers =
    useOffersForRequests(requests.filter((r) => r.requester_id === me).map((r) => r.id)).data ?? [];

  const otherOf = (requestId: string): string | undefined => {
    const fromThem = (recent.data ?? []).find(
      (m) => m.request_id === requestId && m.sender_id !== me,
    );
    if (fromThem) return fromThem.sender_id;
    const r = requests.find((x) => x.id === requestId);
    if (!r) return undefined;
    if (r.requester_id !== me) return r.requester_id;
    return offers.find((o) => o.id === r.accepted_offer_id)?.traveler_id;
  };
  const people = useProfilesByIds(ids.map(otherOf).filter((x): x is string => !!x)).data ?? [];

  if (!recent.data) {
    return (
      <LoadingView
        error={recent.isError ? t('common.networkError') : undefined}
        retryLabel={t('common.retry')}
        onRetry={() => recent.refetch()}
      />
    );
  }

  return (
    <Screen inTabs>
      <Text variant="title" style={styles.title}>
        {t('messages.title')}
      </Text>
      {ids.length === 0 ? (
        <Text variant="body" muted style={styles.empty}>
          {t('messages.empty')}
        </Text>
      ) : null}
      {ids.map((requestId) => {
        const m = latest.get(requestId)!;
        const name = people.find((p) => p.id === otherOf(requestId))?.full_name ?? '';
        const unread = notifications.filter(
          (n) => n.kind === 'message' && n.request_id === requestId && n.read_at === null,
        ).length;
        const preview = m.body || `📷 ${t('messages.photo')}`;
        return (
          <Card
            key={requestId}
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[requestId]', params: { requestId } })}
          >
            <Avatar name={name} size={56} />
            <View style={styles.flex}>
              <View style={styles.line}>
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" muted>
                  {formatWhen(m.created_at)}
                </Text>
              </View>
              <View style={styles.line}>
                <Text
                  variant={unread > 0 ? 'label' : 'caption'}
                  style={styles.flex}
                  numberOfLines={1}
                >
                  {preview}
                </Text>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" muted numberOfLines={1}>
                {requests.find((r) => r.id === requestId)?.item_name ?? ''}
              </Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.sm },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.teal },
});
