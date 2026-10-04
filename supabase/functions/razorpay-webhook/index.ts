// Razorpay webhooks (payment.captured, order.paid, payment.failed, refund.processed).
// payment.failed is stored for the record only: the order stays payable for a retry.
// No user JWT (verify_jwt = false in config.toml); trust comes from the signature.
// Replays are safe twice over: events are stored by Razorpay's event id, and the
// database record_* functions are idempotent.
import { dbError, env, handle, json, serviceClient } from '../_shared/http.ts';
import { parseWebhook, verifyWebhookSignature } from '../_shared/razorpay.ts';

Deno.serve(
  handle(async (req) => {
    const raw = await req.text();
    const signed = await verifyWebhookSignature(
      raw,
      req.headers.get('x-razorpay-signature'),
      env('RAZORPAY_WEBHOOK_SECRET'),
    );
    if (!signed) return json({ error: { code: 'bad_signature' } }, 400);

    const body = JSON.parse(raw);
    const eventId = req.headers.get('x-razorpay-event-id');
    if (!eventId) return json({ error: { code: 'missing_event_id' } }, 400);

    const db = serviceClient();
    await db
      .from('webhook_events')
      .upsert(
        { event_id: eventId, event_type: body.event ?? '', payload: body },
        { onConflict: 'event_id', ignoreDuplicates: true },
      );
    const { data: stored } = await db
      .from('webhook_events')
      .select('processed_at')
      .eq('event_id', eventId)
      .single();
    if (stored?.processed_at) return json({ status: 'duplicate' });

    const action = parseWebhook(body);
    let error = null;
    if (action.kind === 'captured') {
      ({ error } = await db.rpc('record_payment_captured', {
        p_razorpay_order_id: action.orderId,
        p_razorpay_payment_id: action.paymentId,
        p_amount_paise: action.amountPaise,
      }));
    } else if (action.kind === 'refund_processed') {
      ({ error } = await db.rpc('record_refund_processed', {
        p_razorpay_payment_id: action.paymentId,
        p_razorpay_refund_id: action.refundId,
        p_amount_paise: action.amountPaise,
      }));
    }
    // HB023: not a Hopbag order, or amounts disagree. Log it and acknowledge, so
    // Razorpay does not retry forever; anything else is retried.
    if (error?.code === 'HB023') {
      console.error('Webhook not recorded', eventId, error.message);
    } else if (error) {
      throw dbError(error);
    }

    await db
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    return json({ status: action.kind });
  }),
);
