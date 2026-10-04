// POST { request_id, reason } by the traveler at pickup: the item is not what was
// asked for. Refunds the requester in full through Razorpay and records why.
import {
  dbError,
  handle,
  HttpError,
  json,
  razorpay,
  rateLimit,
  readJson,
  requireUser,
  serviceClient,
} from '../_shared/http.ts';

type Payment = { id: string; razorpay_payment_id: string; amount_paise: number };

Deno.serve(
  handle(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    await rateLimit(db, `decline-pickup:${user.id}`, 5, 60);
    const { request_id, reason } = await readJson<{ request_id: string; reason?: string }>(req);
    if (!reason || reason.trim().length < 3) throw new HttpError(400, 'HB027');

    const { data: payment, error } = await db
      .rpc('decline_pickup_quote', { p_request_id: request_id, p_user_id: user.id })
      .single<Payment>();
    if (error) throw dbError(error);

    const { error: declineError } = await db.rpc('record_pickup_declined', {
      p_request_id: request_id,
      p_user_id: user.id,
      p_reason: reason.trim(),
    });
    if (declineError) throw dbError(declineError);

    const refund = await razorpay().refundPayment(
      payment.razorpay_payment_id,
      payment.amount_paise,
      {
        request_id,
        reason: 'declined_at_pickup',
      },
    );
    const { error: requestedError } = await db.rpc('record_refund_requested', {
      p_payment_id: payment.id,
      p_razorpay_refund_id: refund.id,
    });
    if (requestedError) throw dbError(requestedError);
    if (refund.status === 'processed') {
      const { error: processedError } = await db.rpc('record_refund_processed', {
        p_razorpay_payment_id: payment.razorpay_payment_id,
        p_razorpay_refund_id: refund.id,
        p_amount_paise: refund.amount,
      });
      if (processedError) throw dbError(processedError);
    }
    return json({ status: 'declined' });
  }),
);
