# Hopbag payments

Status: Phase 5, Razorpay **TEST mode** only. No live keys until the lawyer, CA and Razorpay have signed off on the items at the end of this document.

## The rule

Hopbag never holds money. Razorpay collects it, holds it and pays it out. Hopbag's database records what Razorpay reports, in paise, so the app can show it. The traveler's "wallet" in the app is a view of what Razorpay is holding for them; it is not a balance Hopbag keeps.

## What happens today (Phase 5)

1. The requester accepts a traveler's offer. They owe **item price + traveler fee**. The requester stated the item price on the request.
2. They tap **Pay**. The `create-order` Edge Function creates a Razorpay order for that amount.
3. Razorpay Checkout opens inside the app. The requester pays with a test card or test UPI.
4. Two independent paths record the payment. Either one is enough, and both together never record it twice:
   - **The app path:** `verify-payment` checks Razorpay's signature (HMAC-SHA256 with the key secret). It then asks Razorpay for the payment's status, captures the payment if needed, and records it.
   - **The webhook path:** Razorpay calls `razorpay-webhook` with `payment.captured` or `order.paid`. Hopbag checks the webhook signature and records the payment.
5. The request becomes **paid**, and the ledger shows the amount **held**. The money stays in Hopbag's Razorpay account, unsettled to the traveler.
6. **Refund before pickup:** the requester taps "Cancel and get a refund". `refund-payment` asks Razorpay for a full refund. When the `refund.processed` webhook arrives, the ledger moves the money back to the requester. The traveler's offer closes, which frees space on their trip.

Releasing the money to the traveler (minus the platform fee) is Phase 6.

### Why replays can't double-count

- Every webhook is stored under Razorpay's event id. A replayed event with the same id is skipped.
- The database functions are idempotent. Recording the same capture or refund twice changes nothing.
- The ledger has a unique key per transaction, so the same event can't post twice. Ledger rows can't be edited or deleted, even by the database owner.
- Amounts are checked against the order. A different amount, or a second payment for an already-paid order, is rejected.

These rules are covered by `supabase/tests/database/05_payments.test.sql` and `src/__tests__/razorpay.test.ts`.

### Ledger (double entry, paise)

| Event | `held` | `requester` |
|---|---|---|
| Payment captured | +amount | −amount |
| Refund processed | −amount | +amount |

Phase 6 adds a release: `held` −amount, `traveler` +(amount − fee), `platform_fee` +fee.

## Settlement options for Phase 6 (to decide with Razorpay, the lawyer and the CA)

Today the captured money sits in Hopbag's Razorpay merchant balance. With the default settings, Razorpay would settle it to Hopbag's bank account, which goes against "Hopbag never holds money". That's fine in test mode, but it must change before live payments. The options:

### A. Razorpay Route with transfers on hold (recommended to explore first)

- Each traveler becomes a **Route linked account**, with Razorpay's KYC and their bank account.
- When a payment is captured, Hopbag creates a **transfer** to the traveler's linked account with `on_hold: true`. It can also be created with the order itself. The money is earmarked for the traveler but not settled.
- When delivery is confirmed (Phase 6), Hopbag sets `on_hold: false`, and Razorpay settles to the traveler's bank. The platform fee is the part that is not transferred.
- **Refund before pickup:** reverse the transfer, then refund the payment.
- **What to check:**
  - Route's eligibility for a C2C marketplace with individual travelers,
  - the KYC each traveler needs,
  - the maximum time a transfer can stay on hold,
  - who pays Route fees,
  - whether Hopbag's own balance ever holds the traveler's share, and for how long.

### B. Razorpay Escrow+ (if Route on hold isn't allowed for this use)

- A regulated escrow account held with a bank trustee. The money sits with the trustee and is released on instructions agreed with them.
- It's closer to a true escrow, but needs more onboarding and paperwork (escrow agreement, trustee) and usually costs more.

### C. Collect, then pay out (not recommended)

- Hopbag captures the money and later pays travelers with Payouts.
- This **does** mean Hopbag holds customer money in between, which goes against our rule and may raise payment-aggregator and escrow questions.

## Questions for the lawyer and CA

1. Is a model where Razorpay holds the funds until delivery confirmation acceptable for C2C goods carriage between states, and does Hopbag stay a marketplace and not a courier or reseller?
2. Hopbag never holds funds. Confirm that no RBI payment-aggregator licence and no prepaid-wallet (PPI) licence is needed. The traveler wallet is only a display of what Razorpay holds.
3. **Item cost passes through Hopbag to the traveler.** Is Hopbag treated as selling goods, or as an e-commerce operator (EO) facilitating a sale? This affects invoicing.
4. **GST on the platform fee:** what rate applies, which place of supply, and what invoice goes to whom.
5. **E-commerce operator obligations:** TCS under section 52 of the CGST Act, and TDS under section 194-O of the Income Tax Act. Do they apply to the traveler fee, the item cost, or both?
6. **Traveler income:** do travelers need to be told about tax on fees they earn? What KYC level fits (Route's KYC versus our own ID check)?
7. **Refund and dispute policy wording:** refunds before pickup, disputes after pickup, the 48-hour auto-confirm in Phase 6, and the refund timelines to show users.
8. **Data:** keep only Razorpay ids, never card or UPI details. Confirm retention periods for payment records, for tax and audit.

## Setup (test mode)

**Secrets.** These go in Supabase, never in `.env` or the app. Set them from your own terminal:

```
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx
```

**Deploy the functions:**

```
supabase functions deploy create-order verify-payment refund-payment razorpay-webhook
```

**Webhook.** In the Razorpay Dashboard (Test mode), go to Settings → Webhooks → Add:
- **URL:** `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`
- **Events:** `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`

**Test payments:**
- **Card:** 4111 1111 1111 1111, any future expiry, any CVV, any OTP.
- **UPI:** `success@razorpay` succeeds and `failure@razorpay` fails.

## Before going live

- Replace the in-app WebView checkout with Razorpay's native SDK in an EAS build (Phase 8). Real UPI apps open more reliably from the native SDK.
- Settle the Route or Escrow+ decision above, and get live KYC approved.
- Switch to live keys only after written sign-off.
