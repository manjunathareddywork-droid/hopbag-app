import type { CheckoutOrder } from '@/features/payments/api';
import { checkoutHtml, parseCheckoutMessage } from '@/features/payments/checkout-html';

const order: CheckoutOrder = {
  order_id: 'order_1',
  key_id: 'rzp_test_abc',
  currency: 'INR',
  amount_paise: 60000,
  item_price_paise: 40000,
  fare_paise: 20000,
  item_name: 'Mysore Pak',
};

describe('checkoutHtml', () => {
  it('passes only public values to Razorpay checkout', () => {
    const html = checkoutHtml(order, { phone: '+919000000001' });
    expect(html).toContain('https://checkout.razorpay.com/v1/checkout.js');
    expect(html).toContain('"key":"rzp_test_abc"');
    expect(html).toContain('"order_id":"order_1"');
    expect(html).toContain('"amount":60000');
    expect(html).toContain('"contact":"+919000000001"');
    expect(html).not.toMatch(/secret/i);
  });

  it('cannot be broken out of by an item name', () => {
    const html = checkoutHtml({ ...order, item_name: '</script><script>alert(1)</script>' }, {});
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });
});

describe('parseCheckoutMessage', () => {
  it('reads a successful payment', () => {
    const raw = JSON.stringify({
      type: 'success',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
    expect(parseCheckoutMessage(raw)).toEqual({
      type: 'success',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
  });

  it('reads a failure reason', () => {
    expect(
      parseCheckoutMessage(JSON.stringify({ type: 'failed', description: 'Card declined' })),
    ).toEqual({ type: 'failed', description: 'Card declined' });
  });

  it('treats anything else as dismissed', () => {
    expect(parseCheckoutMessage('not json')).toEqual({ type: 'dismissed' });
    expect(parseCheckoutMessage(JSON.stringify({ type: 'success' }))).toEqual({
      type: 'dismissed',
    });
  });
});
