import type { Payment } from '@/lib/database.types';
import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export type CheckoutOrder = {
  order_id: string;
  key_id: string;
  currency: 'INR';
  amount_paise: number;
  item_price_paise: number;
  fare_paise: number;
  item_name: string;
};

export type CheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const createOrder = (requestId: string) =>
  callFunction<CheckoutOrder>('create-order', { request_id: requestId });

export const verifyPayment = (result: CheckoutSuccess) =>
  callFunction<{ status: 'captured' }>('verify-payment', result);

export const refundPayment = (requestId: string) =>
  callFunction<{ status: 'refunded' | 'refund_pending' }>('refund-payment', {
    request_id: requestId,
  });

/** The live payment for a request (requester or traveler view), if any. */
export async function fetchPaymentForRequest(requestId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('request_id', requestId)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Payments Razorpay is holding for this traveler (locked until delivery). */
export async function fetchHeldForTraveler(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('traveler_id', userId)
    .eq('status', 'captured');
  if (error) throw error;
  return data;
}
