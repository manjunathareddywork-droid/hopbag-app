import {
  formatRupees,
  renderNotification,
} from '../../supabase/functions/_shared/notification-text';
import { notificationRoute, notificationText } from '@/features/notifications/text';
import { formatPaise } from '@/lib/money';
import type { NotificationKind } from '@/lib/database.types';

const kinds: NotificationKind[] = [
  'offer_received',
  'offer_accepted',
  'offer_not_chosen',
  'request_paid',
  'picked_up',
  'handed_over',
  'completed',
  'payout_unlocked',
  'disputed',
  'dispute_resolved',
  'refunded',
  'expired',
  'message',
  'rated',
  'id_approved',
  'id_rejected',
  'ticket_approved',
  'ticket_rejected',
];

describe('notification wording', () => {
  it.each(kinds)('%s has in-app and push text', (kind) => {
    const params = { item: 'Mysore Pak', name: 'Bala', amount: 25000, preview: 'Hi', stars: 5 };
    const app = notificationText({ kind, params });
    const push = renderNotification(kind, params);
    expect(app.title).not.toMatch(/notifications\./);
    expect(app.body).not.toMatch(/\{\{/);
    expect(push.title.length).toBeGreaterThan(0);
    expect(push.body.length).toBeGreaterThan(0);
  });

  it('fills in names and amounts', () => {
    expect(
      notificationText({
        kind: 'offer_received',
        params: { name: 'Bala', amount: 25000, item: 'Mysore Pak' },
      }).body,
    ).toBe('Bala offered ₹250 to carry Mysore Pak.');
  });

  it('push and app format rupees the same way', () => {
    for (const paise of [5000, 120000, 12345650, 105]) {
      expect(formatRupees(paise)).toBe(formatPaise(paise));
    }
  });
});

describe('notificationRoute', () => {
  it('opens the chat for messages', () => {
    expect(notificationRoute({ kind: 'message', request_id: 'r1', trip_id: null }, [])).toEqual({
      pathname: '/chat/[requestId]',
      params: { requestId: 'r1' },
    });
  });

  it('opens the requester view for a new offer', () => {
    expect(
      notificationRoute({ kind: 'offer_received', request_id: 'r1', trip_id: null }, []),
    ).toEqual({
      pathname: '/requests/[id]',
      params: { id: 'r1' },
    });
  });

  it('opens the traveler view for a payment received', () => {
    expect(
      notificationRoute({ kind: 'request_paid', request_id: 'r1', trip_id: null }, []),
    ).toEqual({
      pathname: '/traveler/requests/[id]',
      params: { id: 'r1' },
    });
  });

  it('picks the side for updates both people get', () => {
    const n = { kind: 'disputed' as const, request_id: 'r1', trip_id: null };
    expect(notificationRoute(n, ['r1'])).toEqual({
      pathname: '/requests/[id]',
      params: { id: 'r1' },
    });
    expect(notificationRoute(n, [])).toEqual({
      pathname: '/traveler/requests/[id]',
      params: { id: 'r1' },
    });
  });
});
