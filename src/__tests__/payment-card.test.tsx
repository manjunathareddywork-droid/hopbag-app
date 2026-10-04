import { screen } from '@testing-library/react-native';

import { en } from '@/i18n/en';
import type { ItemRequest, Offer, Payment } from '@/lib/database.types';
import { PaymentCard } from '@/features/payments/payment-card';
import { renderWithQuery } from '@/test-utils';

const mockPayment: { current: Payment | null } = { current: null };
jest.mock('@/features/payments/hooks', () => ({
  usePaymentForRequest: () => ({ data: mockPayment.current }),
  useRefundPayment: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));

const request = {
  id: 'r1',
  status: 'accepted',
  item_price_paise: 40000,
  accepted_offer_id: 'o1',
} as ItemRequest;
const offer = { id: 'o1', fare_paise: 20000 } as Offer;

describe('PaymentCard', () => {
  it('shows item price + fee and a pay button after accepting', async () => {
    mockPayment.current = null;
    await renderWithQuery(<PaymentCard request={request} acceptedOffer={offer} />);

    expect(screen.getByText('₹400')).toBeTruthy();
    expect(screen.getByText('₹200')).toBeTruthy();
    expect(screen.getByText('₹600')).toBeTruthy();
    expect(screen.getByText('Pay ₹600')).toBeTruthy();
  });

  it('asks for the item price on older requests', async () => {
    await renderWithQuery(
      <PaymentCard request={{ ...request, item_price_paise: null }} acceptedOffer={offer} />,
    );
    expect(screen.getByText(en.payment.needsPrice)).toBeTruthy();
  });

  it('says the money is held and offers a refund before pickup', async () => {
    mockPayment.current = { amount_paise: 60000, status: 'captured' } as Payment;
    await renderWithQuery(
      <PaymentCard request={{ ...request, status: 'paid' }} acceptedOffer={offer} />,
    );
    expect(screen.getByText('₹600 paid. Held by Razorpay until delivery.')).toBeTruthy();
    expect(screen.getByText(en.payment.cancelAndRefund)).toBeTruthy();
  });

  it('shows a refund in progress', async () => {
    mockPayment.current = { amount_paise: 60000, status: 'refund_pending' } as Payment;
    await renderWithQuery(
      <PaymentCard request={{ ...request, status: 'refunded' }} acceptedOffer={offer} />,
    );
    expect(
      screen.getByText('Refund of ₹600 is on its way (usually 5 to 7 working days).'),
    ).toBeTruthy();
    expect(screen.queryByText(en.payment.cancelAndRefund)).toBeNull();
  });
});
