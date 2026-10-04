// Daily (pg_cron via pg_net, shared secret): deletes chat photos 7 days after the
// request finished, through the Storage API, then marks them deleted.
import { env, handle, json, serviceClient } from '../_shared/http.ts';
import { timingSafeEqual } from '../_shared/razorpay.ts';

Deno.serve(
  handle(async (req) => {
    const auth = req.headers.get('Authorization') ?? '';
    if (!timingSafeEqual(auth, `Bearer ${env('NOTIFICATIONS_CRON_SECRET')}`)) {
      return json({ error: { code: 'unauthorized' } }, 401);
    }

    const db = serviceClient();
    const { data, error } = await db.rpc('chat_photos_due', { p_limit: 200 });
    if (error) throw error;
    const due = data as { message_id: number; photo_path: string }[];
    if (due.length === 0) return json({ deleted: 0 });

    const { error: removeError } = await db.storage
      .from('chat-photos')
      .remove(due.map((d) => d.photo_path));
    if (removeError) throw removeError;

    const { error: markError } = await db.rpc('mark_chat_photos_deleted', {
      p_message_ids: due.map((d) => d.message_id),
    });
    if (markError) throw markError;
    return json({ deleted: due.length });
  }),
);
