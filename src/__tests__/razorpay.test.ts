/**
 * @jest-environment node
 */
/// <reference types="node" />
import { createHmac } from 'crypto';

import {
  parseWebhook,
  RazorpayClient,
  timingSafeEqual,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../../supabase/functions/_shared/razorpay';

const keySecret = 'test_key_secret';
const webhookSecret = 'test_webhook_secret';
const hmac = (secret: string, message: string) =>
  createHmac('sha256', secret).update(message).digest('hex');

describe('checkout signature', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  it('accepts the signature Razorpay sends for this order and payment', async () => {
    const signature = hmac(keySecret, `${orderId}|${paymentId}`);
    await expect(
      verifyCheckoutSignature({ orderId, paymentId, signature }, keySecret),
    ).resolves.toBe(true);
  });

  it('rejects a signature for a different payment', async () => {
    const signature = hmac(keySecret, `${orderId}|pay_OTHER`);
    await expect(
      verifyCheckoutSignature({ orderId, paymentId, signature }, keySecret),
    ).resolves.toBe(false);
  });

  it('rejects a signature made with another secret', async () => {
    const signature = hmac('wrong_secret', `${orderId}|${paymentId}`);
    await expect(
      verifyCheckoutSignature({ orderId, paymentId, signature }, keySecret),
    ).resolves.toBe(false);
  });

  it('rejects missing fields', async () => {
    await expect(
      verifyCheckoutSignature({ orderId, paymentId, signature: '' }, keySecret),
    ).resolves.toBe(false);
  });
});

describe('webhook signature', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });

  it('accepts the exact raw body', async () => {
    await expect(
      verifyWebhookSignature(body, hmac(webhookSecret, body), webhookSecret),
    ).resolves.toBe(true);
  });

  it('rejects a body that was changed after signing', async () => {
    const tampered = body.replace('captured', 'failed');
    await expect(
      verifyWebhookSignature(tampered, hmac(webhookSecret, body), webhookSecret),
    ).resolves.toBe(false);
  });

  it('rejects a missing signature header', async () => {
    await expect(verifyWebhookSignature(body, null, webhookSecret)).resolves.toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('compares strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('parseWebhook', () => {
  const payment = { id: 'pay_1', order_id: 'order_1', amount: 60000, status: 'captured' };

  it.each(['payment.captured', 'order.paid'])('%s records a capture', (event) => {
    expect(parseWebhook({ event, payload: { payment: { entity: payment } } })).toEqual({
      kind: 'captured',
      orderId: 'order_1',
      paymentId: 'pay_1',
      amountPaise: 60000,
    });
  });

  it('payment.failed marks the order failed', () => {
    expect(
      parseWebhook({ event: 'payment.failed', payload: { payment: { entity: payment } } }),
    ).toEqual({ kind: 'failed', orderId: 'order_1' });
  });

  it('refund.processed records the refund', () => {
    expect(
      parseWebhook({
        event: 'refund.processed',
        payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 60000 } } },
      }),
    ).toEqual({
      kind: 'refund_processed',
      paymentId: 'pay_1',
      refundId: 'rfnd_1',
      amountPaise: 60000,
    });
  });

  it('ignores other events and malformed bodies', () => {
    expect(parseWebhook({ event: 'payment.authorized', payload: {} })).toEqual({
      kind: 'ignored',
      event: 'payment.authorized',
    });
    expect(parseWebhook(null)).toEqual({ kind: 'ignored', event: '' });
  });
});

describe('RazorpayClient', () => {
  it('creates an order in paise with basic auth', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_1', amount: 60000, currency: 'INR', status: 'created' }),
    });
    const client = new RazorpayClient(
      'rzp_test_key',
      keySecret,
      fetchMock as unknown as typeof fetch,
    );

    const order = await client.createOrder({
      amountPaise: 60000,
      receipt: 'req-1',
      notes: { request_id: 'req-1' },
    });

    expect(order.id).toBe('order_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from(`rzp_test_key:${keySecret}`).toString('base64')}`,
    );
    expect(JSON.parse(init.body)).toEqual({
      amount: 60000,
      currency: 'INR',
      receipt: 'req-1',
      notes: { request_id: 'req-1' },
    });
  });

  it('throws with the status when Razorpay refuses', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: 'bad' } }),
    });
    const client = new RazorpayClient('k', 's', fetchMock as unknown as typeof fetch);
    await expect(client.fetchPayment('pay_1')).rejects.toMatchObject({ status: 400 });
  });
});
