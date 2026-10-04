// POST { request_id } -> full refund of a paid request before pickup (PRODUCT.md).
// The refund.processed webhook completes the ledger if Razorpay processes it later.
import {
  dbError,
  handle,
  json,
  razorpay,
  rateLimit,
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
    await rateLimit(db, `refund-payment:${user.id}`, 5, 60);
    const { request_id } = await readJson<{ request_id: string }>(req);

    const { data: payment, error } = await db
      .rpc('refund_quote', { p_request_id: request_id, p_user_id: user.id })
      .single<Payment>();
    if (error) throw dbError(error);
    if (payment.status === 'refund_pending') return json({ status: 'refund_pending' });

    const refund = await razorpay().refundPayment(
      payment.razorpay_payment_id,
      payment.amount_paise,
      {
        request_id,
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

    return json({ status: refund.status === 'processed' ? 'refunded' : 'refund_pending' });
  }),
);
