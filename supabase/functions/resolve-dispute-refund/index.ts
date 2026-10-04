// POST { request_id, note } by an admin: refund a disputed request in full through
// Razorpay and close the dispute. (Releasing to the traveler needs no Razorpay call
// yet, so admins do that with the resolve_dispute_release database function.)
import {
  dbError,
  handle,
  json,
  razorpay,
  readJson,
  requireUser,
  serviceClient,
} from '../_shared/http.ts';

type Payment = {
  id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  status: string;
};

Deno.serve(
  handle(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    const { request_id, note } = await readJson<{ request_id: string; note?: string }>(req);

    // Checks the caller is an admin and the request has an open dispute.
    const { data: payment, error } = await db
      .rpc('admin_refund_quote', { p_request_id: request_id, p_user_id: user.id })
      .single<Payment>();
    if (error) throw dbError(error);

    if (payment.status === 'captured') {
      const refund = await razorpay().refundPayment(
        payment.razorpay_payment_id,
        payment.amount_paise,
        { request_id, reason: 'dispute' },
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
    }

    const { error: closeError } = await db.rpc('close_dispute_refunded', {
      p_request_id: request_id,
      p_admin_id: user.id,
      p_note: note ?? '',
    });
    if (closeError) throw dbError(closeError);

    return json({ status: 'refunded' });
  }),
);
