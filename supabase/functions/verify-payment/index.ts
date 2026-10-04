// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } from checkout.
// Checks the signature, confirms with Razorpay, captures if needed and records it.
// The razorpay-webhook function records the same capture too; both are idempotent.
import {
  dbError,
  env,
  handle,
  HttpError,
  json,
  razorpay,
  readJson,
  requireUser,
  serviceClient,
} from '../_shared/http.ts';
import { verifyCheckoutSignature } from '../_shared/razorpay.ts';

type Body = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

Deno.serve(
  handle(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    const body = await readJson<Body>(req);

    const valid = await verifyCheckoutSignature(
      {
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
      },
      env('RAZORPAY_KEY_SECRET'),
    );
    if (!valid) throw new HttpError(400, 'bad_signature');

    const { data: record } = await db
      .from('payments')
      .select('requester_id')
      .eq('razorpay_order_id', body.razorpay_order_id)
      .maybeSingle();
    if (!record || record.requester_id !== user.id) throw new HttpError(404, 'HB011');

    const rzp = razorpay();
    let payment = await rzp.fetchPayment(body.razorpay_payment_id);
    if (payment.order_id !== body.razorpay_order_id) throw new HttpError(400, 'bad_signature');
    if (payment.status === 'authorized') {
      payment = await rzp.capturePayment(payment.id, payment.amount);
    }
    if (payment.status !== 'captured') throw new HttpError(409, 'not_captured');

    const { error } = await db.rpc('record_payment_captured', {
      p_razorpay_order_id: body.razorpay_order_id,
      p_razorpay_payment_id: payment.id,
      p_amount_paise: payment.amount,
    });
    if (error) throw dbError(error);

    return json({ status: 'captured' });
  }),
);
