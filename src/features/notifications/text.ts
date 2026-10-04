import type { Href } from 'expo-router';

import { t, type StringKey } from '@/i18n';
import type { AppNotification, NotificationKind } from '@/lib/database.types';
import { formatDateTime } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

/** Notification wording from the i18n file (push text: supabase/functions/_shared/notification-text.ts). */
export function notificationText(n: Pick<AppNotification, 'kind' | 'params'>): {
  title: string;
  body: string;
} {
  const p = n.params ?? {};
  const values = {
    item: p.item ?? '',
    name: p.name ?? '',
    amount: typeof p.amount === 'number' ? formatPaise(p.amount) : '',
    preview: p.preview ?? '',
    reason: p.reason ?? '',
    stars: p.stars ?? '',
    deadline: p.deadline ? formatDateTime(p.deadline) : '',
  };
  const kind =
    n.kind === 'dispute_resolved'
      ? p.resolution === 'refunded'
        ? 'dispute_refunded'
        : 'dispute_released'
      : n.kind;
  return {
    title: t(`notifications.kinds.${kind}.title` as StringKey, values),
    body: t(`notifications.kinds.${kind}.body` as StringKey, values),
  };
}

/** Kinds that are about the requester's own request (others: the traveler's side). */
const REQUESTER_KINDS: NotificationKind[] = [
  'offer_received',
  'picked_up',
  'handed_over',
  'completed',
  'expired',
];
const SHARED_KINDS: NotificationKind[] = ['disputed', 'dispute_resolved', 'refunded', 'rated'];

/** Where tapping an update (or a push) goes. */
export function notificationRoute(
  n: Pick<AppNotification, 'kind' | 'request_id' | 'trip_id'>,
  myRequestIds: string[],
): Href {
  if (n.kind === 'message' && n.request_id) {
    return { pathname: '/chat/[requestId]', params: { requestId: n.request_id } };
  }
  if (n.kind === 'id_approved' || n.kind === 'id_rejected') return '/traveler';
  if ((n.kind === 'ticket_approved' || n.kind === 'ticket_rejected') && n.trip_id) {
    return { pathname: '/traveler/trips/[id]', params: { id: n.trip_id } };
  }
  if (!n.request_id) return '/';
  const asRequester =
    REQUESTER_KINDS.includes(n.kind) ||
    (SHARED_KINDS.includes(n.kind) && myRequestIds.includes(n.request_id));
  return asRequester
    ? { pathname: '/requests/[id]', params: { id: n.request_id } }
    : { pathname: '/traveler/requests/[id]', params: { id: n.request_id } };
}
