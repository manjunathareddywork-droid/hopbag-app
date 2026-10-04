-- A failed payment attempt (Razorpay payment.failed) does not end the order:
-- the requester can retry on the same order, and Razorpay's checkout does this.
-- So a failed attempt changes nothing here. A payment row becomes 'failed' only
-- when its order is replaced (record_order_created) or the request is cancelled.
-- Marking it failed on the first failed attempt could later block recording a
-- successful retry when a newer order exists for the same request.
drop function public.record_payment_failed(text);
