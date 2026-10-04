// Called every minute by pg_cron (via pg_net) when there are notifications to push.
// Authenticated with a shared secret (verify_jwt = false). Claims a batch (each
// notification is pushed at most once), sends it through the Expo Push API, and
// forgets device tokens Expo reports as no longer registered.
import { env, handle, json, serviceClient } from '../_shared/http.ts';
import { renderNotification, type NotificationParams } from '../_shared/notification-text.ts';
import { timingSafeEqual } from '../_shared/razorpay.ts';

type Claimed = {
  id: number;
  kind: string;
  request_id: string | null;
  trip_id: string | null;
  params: NotificationParams;
  tokens: string[];
};

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;

Deno.serve(
  handle(async (req) => {
    const auth = req.headers.get('Authorization') ?? '';
    if (!timingSafeEqual(auth, `Bearer ${env('NOTIFICATIONS_CRON_SECRET')}`)) {
      return json({ error: { code: 'unauthorized' } }, 401);
    }

    const db = serviceClient();
    const { data, error } = await db.rpc('claim_push_batch', { p_limit: 300 });
    if (error) throw error;

    const messages = (data as Claimed[]).flatMap((n) =>
      n.tokens.map((to) => ({
        to,
        sound: 'default',
        ...renderNotification(n.kind, n.params),
        data: { kind: n.kind, requestId: n.request_id, tripId: n.trip_id },
      })),
    );

    const unregistered: string[] = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH) {
      const chunk = messages.slice(i, i + EXPO_BATCH);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const body = await res.json().catch(() => null);
      const tickets: Ticket[] = body?.data ?? [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          unregistered.push(chunk[index].to);
        }
      });
    }

    if (unregistered.length > 0) {
      await db.rpc('forget_push_tokens', { p_tokens: unregistered });
    }
    return json({ sent: messages.length, forgotten: unregistered.length });
  }),
);
