// Razorpay helpers shared by the Edge Functions. No imports and no Deno APIs so the
// same code is unit-tested with Jest (src/__tests__/razorpay.test.ts).
// Secrets (key secret, webhook secret) are passed in by the caller from Supabase secrets.

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compares without stopping at the first difference, so timing reveals nothing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckoutSignature(
  input: { orderId: string; paymentId: string; signature: string },
  keySecret: string,
): Promise<boolean> {
  if (!input.orderId || !input.paymentId || !input.signature) return false;
  const expected = await hmacSha256Hex(keySecret, `${input.orderId}|${input.paymentId}`);
  return timingSafeEqual(expected, input.signature);
}

/** Webhooks: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook_secret). */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return timingSafeEqual(expected, signature);
}

export type WebhookAction =
  | { kind: 'captured'; orderId: string; paymentId: string; amountPaise: number }
  | { kind: 'failed'; orderId: string }
  | { kind: 'refund_processed'; paymentId: string; refundId: string; amountPaise: number }
  | { kind: 'ignored'; event: string };

type Entity = Record<string, unknown>;

/** Turns a Razorpay webhook body into the one thing Hopbag needs to record. */
export function parseWebhook(body: unknown): WebhookAction {
  const event = (body as { event?: string })?.event ?? '';
  const payload = ((body as { payload?: Entity })?.payload ?? {}) as Record<
    string,
    { entity?: Entity }
  >;
  const payment = payload.payment?.entity ?? {};
  const refund = payload.refund?.entity ?? {};

  switch (event) {
    case 'payment.captured':
    case 'order.paid':
      if (typeof payment.order_id === 'string' && typeof payment.id === 'string') {
        return {
          kind: 'captured',
          orderId: payment.order_id,
          paymentId: payment.id,
          amountPaise: Number(payment.amount),
        };
      }
      break;
    case 'payment.failed':
      if (typeof payment.order_id === 'string') {
        return { kind: 'failed', orderId: payment.order_id };
      }
      break;
    case 'refund.processed':
      if (typeof refund.payment_id === 'string' && typeof refund.id === 'string') {
        return {
          kind: 'refund_processed',
          paymentId: refund.payment_id,
          refundId: refund.id,
          amountPaise: Number(refund.amount),
        };
      }
      break;
  }
  return { kind: 'ignored', event };
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };
export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
};
export type RazorpayRefund = { id: string; payment_id: string; amount: number; status: string };

export class RazorpayError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Razorpay API error ${status}`);
  }
}

/** Minimal Razorpay REST client (Orders, Payments, Refunds). */
export class RazorpayClient {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = 'https://api.razorpay.com/v1',
  ) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new RazorpayError(res.status, json);
    return json as T;
  }

  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    return this.call<RazorpayOrder>('POST', '/orders', {
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });
  }

  fetchPayment(paymentId: string) {
    return this.call<RazorpayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
  }

  capturePayment(paymentId: string, amountPaise: number) {
    return this.call<RazorpayPayment>(
      'POST',
      `/payments/${encodeURIComponent(paymentId)}/capture`,
      {
        amount: amountPaise,
        currency: 'INR',
      },
    );
  }

  refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>) {
    return this.call<RazorpayRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: amountPaise,
      speed: 'normal',
      notes,
    });
  }
}
