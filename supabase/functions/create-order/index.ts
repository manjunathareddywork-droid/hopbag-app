// POST { request_id } -> Razorpay order for an accepted request (item price + fare).
// Reuses an unpaid order for the same amount instead of creating another.
import {
  dbError,
  env,
  handle,
  json,
  razorpay,
  rateLimit,
  readJson,
  requireUser,
  serviceClient,
} from '../_shared/http.ts';

type Quote = {
  request_id: string;
  offer_id: string;
  item_name: string;
  item_price_paise: number;
  fare_paise: number;
  amount_paise: number;
  existing_order_id: string | null;
};

Deno.serve(
  handle(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    await rateLimit(db, `create-order:${user.id}`, 10, 60);
    const { request_id } = await readJson<{ request_id: string }>(req);

    const { data: quote, error } = await db
      .rpc('payment_quote', { p_request_id: request_id, p_user_id: user.id })
      .single<Quote>();
    if (error) throw dbError(error);

    let orderId = quote.existing_order_id;
    if (!orderId) {
      const order = await razorpay().createOrder({
        amountPaise: quote.amount_paise,
        receipt: request_id,
        notes: { request_id, offer_id: quote.offer_id },
      });
      const { error: recordError } = await db.rpc('record_order_created', {
        p_request_id: request_id,
        p_user_id: user.id,
        p_razorpay_order_id: order.id,
      });
      if (recordError) throw dbError(recordError);
      orderId = order.id;
    }

    return json({
      order_id: orderId,
      key_id: env('RAZORPAY_KEY_ID'),
      currency: 'INR',
      amount_paise: quote.amount_paise,
      item_price_paise: quote.item_price_paise,
      fare_paise: quote.fare_paise,
      item_name: quote.item_name,
    });
  }),
);
