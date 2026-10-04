# Hopbag security review (Phase 8)

Date: 2026-10-05. Scope: Postgres row-level security (RLS) and grants, database functions, Storage, Edge Functions, the app's handling of secrets, and the hosted Supabase project.

## How it was reviewed

- **Supabase Database Advisors** (`supabase db advisors --linked --type all`), run against the live project with migrations up to Phase 6 applied. It returned 43 results; each is assessed below.
- **Catalog checks** on the live database:
  - every table in `public` has RLS on,
  - every `SECURITY DEFINER` function has a fixed `search_path`,
  - what `anon` can read or execute,
  - Storage bucket visibility, size and type limits.
- **Manual review** of all 15 migrations, every RLS policy and `SECURITY DEFINER` function, and all 6 Edge Functions.
- **The automated test suite**, which guards the behaviour: 9 pgTAP files with 370+ database checks (including a guard that fails CI if any table lacks RLS or a policy), and 244 app tests.

## Result

There are no critical or high findings in the code. The highest risks are **configuration items on the hosted project** (H1 and H2) that must be done before real users join.

| # | Severity | Finding | Status |
|---|---|---|---|
| H1 | High (launch blocker) | Test phone numbers with a fixed OTP (123456) are enabled on the live project. Anyone can sign in as those accounts. | **Open, your action.** Remove them in Supabase → Authentication → Phone before inviting testers. Your admin account is your real number, so the test accounts have no admin rights. |
| H2 | High (cost) | SMS pumping: anyone can call the Supabase OTP endpoint directly (bypassing the app's +91 check) and run up Twilio charges. | **Open, your action.** In Twilio, allow SMS to India only (Messaging → Geo permissions) and turn on its SMS fraud protection. In Supabase → Authentication → Rate limits, keep the SMS limit low (for example 30 an hour). |
| M1 | Medium | Suspension reason was stored on `profiles`, which every signed-in user can read. | **Fixed.** Moved to `account_suspensions`, which only the person and admins can read. |
| M2 | Medium | `is_blocked_between` and `is_suspended` could be called through the API to find out whether two other people had blocked each other, or whether someone was suspended. | **Fixed.** Both now answer only about the caller (or for admins and server code). Tested. |
| M3 | Medium | Edge Functions returned Postgres `details` for any database error, which could echo internal values (for example duplicate-key details) to the app. | **Fixed.** Only our own HB0xx rule errors carry details. Other errors are logged on the server and returned as `internal_error`. Malformed ids return 400. |
| M4 | Medium | An admin can approve their own ID and tickets. This was needed for the Phase 3 test. | **Open, your decision.** Recommended before launch: refuse self-review (HB0xx) and keep at least two admins. It's a two-line change; tell me to apply it. |
| M5 | Medium | Payments: captured money settles to Hopbag's Razorpay balance until Route or Escrow+ is set up, which goes against "Hopbag never holds money". | **Open, legal and Razorpay.** Test mode only. See docs/PAYMENTS.md. No live keys until this is decided. |
| L1 | Low | Advisor `authenticated_security_definer_function_executable` (21 functions). | **Accepted, by design.** These are the app's API (make_offer, accept_offer, cancel_request, review_*, and so on). Each checks `auth.uid()` and the request state inside, and the tests cover the refusals. The read-only helpers (`owns_request`, `has_offer_on`, `is_admin`, `request_traveler`, `is_verified_traveler`, `trip_can_carry`) reveal only facts about the caller, or values already visible to them, or ids that can't be guessed. |
| L2 | Low | `request_traveler(request_id)` returns the chosen traveler's id for any request id the caller knows. A traveler whose offer lost can learn who won. | **Accepted.** That traveler's name and badge are public profile data anyway. Revisit if requests become private. |
| L3 | Low | `anon` could execute four harmless helpers (`find_blocked_term`, `setting`, `today_ist`, `request_transition_allowed`). Trigger functions also showed as executable, but they can't be called directly. | **Fixed.** Revoked from `anon`. |
| L4 | Low | `app_errors` and `app_events` accept inserts from signed-out users, so they could be flooded with junk. | **Mitigated.** Anonymous traffic shares a capped bucket (60 errors and 120 events a minute). Signed-in users are capped per person. Rows are trimmed after 90 and 180 days. Watch table size on the dashboard. |
| L5 | Low | Push notifications carry item names and the first 80 characters of chat messages, which pass through Expo's and Google's push services. | **Accepted for beta.** Before launch, consider sending "New message from Bala" without the preview. |
| L6 | Low | Phone-number blocking in offers and chat can be bypassed by spelling numbers out ("nine eight seven…"). | **Accepted.** It deters casual sharing. Payment is held regardless, and reports cover abuse. |
| L7 | Low | The Razorpay checkout runs in a WebView (Expo Go has no native SDK). | **Open, before live payments.** Switch to the native Razorpay SDK in the EAS build. Card details never touch Hopbag either way. |
| L8 | Low | Supabase Auth was flagged for leaked-password protection being off. | **Not applicable.** Hopbag has no passwords; sign-in is phone OTP only. |
| I1 | Info | 16 foreign keys had no index (advisor `unindexed_foreign_keys`). | **Fixed for the ones used in lookups and RLS** (payments, payouts, deliveries, disputes, accepted offer, home city). Admin-only `reviewed_by` columns are left. |
| I2 | Info | `item_requests` has several permissive SELECT policies (advisor `multiple_permissive_policies`). | **Accepted.** Kept separate for readability (owner, verified travelers, offer makers); performance is fine at this scale. |
| I3 | Info | 4 unused indexes. | **Accepted.** The tables are new and nearly empty; recheck after beta. |

## Things checked and found correct

- **RLS on every table:** every one of the 30+ tables in `public` has RLS on and at least one policy. A pgTAP guard fails CI if a new table doesn't.
- **Writes go through checks:** clients can't write status, money, review or ownership columns directly. Column-level grants and `SECURITY DEFINER` functions enforce the rules from docs/PRODUCT.md: the allowlist, blocked items, the state machine, fare band, trip caps, and only verified travelers carrying.
- **Every `SECURITY DEFINER` function** sets `search_path = ''`, which closes off search-path hijacking.
- **Secrets:** the Razorpay key secret, webhook secret, service role key and cron secret live only in Supabase secrets and Vault. The app ships only the publishable key, and `.env` is gitignored.
- **Webhooks:**
  - The signature is checked against the raw body with a timing-safe comparison.
  - Events are deduplicated by event id, and payment amounts are checked against the order.
  - Capture and refund are recorded idempotently, so replays post nothing twice (tested).
- **Ledger:** `ledger_entries` is append-only, enforced by a trigger, even for the database owner.
- **Storage:** all buckets are private, with size and type limits.
  - ID photos and tickets can be read only by their owner and admins, and can't be changed after upload.
  - Pickup photos can be read only by the two people in the delivery and admins.
- **Handover codes:** stored hashed, one-time, and locked after 5 wrong tries.
- **Rate limits:** Edge Functions are limited per user (create order 10/min, verify 20/min, refund 5/min, dispute refund 10/min). In the database: messages 30/min, offers 30/hour, requests 20/day, reports 10/day.
- **Admin access:** admin screens are a convenience only. Every admin read and action is checked in the database (`is_admin()` and admin-only RLS).

## Before inviting 10–20 testers

1. H1: remove the test phone numbers.
2. H2: Twilio India-only geo permissions and fraud protection; keep the Supabase SMS rate limit low.
3. Decide M4 (self-approval). Add a second admin if you can.
4. Remember the open product test: run the dispute path end to end on a phone.
