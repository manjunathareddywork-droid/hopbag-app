import { colors } from '@/theme';

import type { CheckoutOrder } from './api';

/** Messages the checkout page posts back to the app. */
export type CheckoutMessage =
  | {
      type: 'success';
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  | { type: 'failed'; description: string }
  | { type: 'dismissed' };

/**
 * Razorpay Standard Checkout in a WebView (Expo Go has no Razorpay native SDK).
 * Only public values go in: the key id, order id and amount. The signature that
 * comes back is verified on the server by verify-payment.
 */
export function checkoutHtml(order: CheckoutOrder, options: { phone?: string }): string {
  const config = {
    key: order.key_id,
    order_id: order.order_id,
    amount: order.amount_paise,
    currency: order.currency,
    name: 'Hopbag',
    description: order.item_name,
    prefill: options.phone ? { contact: options.phone } : {},
    theme: { color: colors.teal },
  };
  // JSON in a <script> tag: escape "<" so a value cannot close the tag.
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background:${colors.background}">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function send(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  var options = ${json};
  options.handler = function (r) {
    send({ type: 'success', razorpay_order_id: r.razorpay_order_id,
           razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature });
  };
  options.modal = { ondismiss: function () { send({ type: 'dismissed' }); } };
  var checkout = new Razorpay(options);
  checkout.on('payment.failed', function (r) {
    send({ type: 'failed', description: (r && r.error && r.error.description) || '' });
  });
  checkout.open();
</script>
</body>
</html>`;
}

/** Parses a message from the page; anything unexpected is treated as dismissed. */
export function parseCheckoutMessage(raw: string): CheckoutMessage {
  try {
    const message = JSON.parse(raw);
    if (
      message?.type === 'success' &&
      typeof message.razorpay_order_id === 'string' &&
      typeof message.razorpay_payment_id === 'string' &&
      typeof message.razorpay_signature === 'string'
    ) {
      return message;
    }
    if (message?.type === 'failed') {
      return { type: 'failed', description: String(message.description ?? '') };
    }
  } catch {
    // fall through
  }
  return { type: 'dismissed' };
}
