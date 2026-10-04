# Hopbag MVP build plan

Use one Claude Code session per phase. Start each by pasting the phase prompt. At the end, ask Claude Code to run tests and summarise what changed, then commit and move on.

Before Phase 0 you need free accounts: Supabase, Razorpay (test mode), Expo (EAS), GitHub.

---
## Phase 0: Foundations (day 1-2)
Goal: empty app runs on your phone, connected to Supabase, brand applied.
Prompt:
> Read CLAUDE.md and docs/PRODUCT.md. Phase 0 only. Create an Expo TypeScript app with Expo Router in this folder. Add ESLint, Prettier, Jest, a theme file with the Hopbag colours and DM Sans/Outfit fonts, an i18n strings file, and a Supabase client reading from .env. Set up the supabase/ folder with migrations, add a GitHub Actions workflow for typecheck + lint + tests. Show a branded splash and a home screen with the logo. Fill the Commands section of CLAUDE.md. Tell me which accounts/keys I must create and where to put them.
Done when: app opens in Expo Go, CI is green, .env.example exists.

## Phase 1: Auth and profiles (day 3-5)
Prompt:
> Phase 1 only. Implement phone OTP sign-in with Supabase Auth, onboarding (name, home city/state, photo), and a profiles table with RLS (users read public fields of others, edit only their own). Add sign-out and an account screen. Write RLS tests.
Done when: sign in on a real phone, profile saved, RLS tests pass.

## Phase 2: Items allowlist and requests (week 2)
Prompt:
> Phase 2 only. Create allowed_categories (seeded with a sensible India-legal starter list, editable by admin), cities/states table, and item_requests with fields from docs/PRODUCT.md. Enforce the allowlist and status rules in the database (constraints/triggers). Build screens: create request (pick category, from/to city, deadline, budget, photo reference), my requests, request detail. Blocked items must show a clear reason.
Done when: a disallowed item cannot be created even via direct API call.

## Phase 3: Trips and traveler verification (week 3)
Prompt:
> Phase 3 only. Add trips (from, to, date, capacity) and traveler_verifications (ID photo, ticket/PNR image and PNR text) stored in a private Storage bucket with RLS. Build the traveler onboarding flow and a minimal admin review screen (web or in-app admin role) to approve/reject with a reason. Unverified users must be blocked from accepting requests at the database level.
Done when: you can approve yourself as admin and see the verified badge.

## Phase 4: Matching and offers (week 4)
Prompt:
> Phase 4 only. Add offers: traveler sees open requests on their route and dates, proposes a fare inside the allowed band; requester sees offers on their request and accepts one. Enforce item caps per trip. Add a route-based feed with filters. Status moves open -> offered -> accepted via database functions, not client updates.
Done when: two test accounts can complete request -> offer -> accept.

## Phase 5: Payments with Razorpay test mode (week 5-6)
Prompt:
> Phase 5 only. Use Razorpay TEST mode. Supabase Edge Functions create orders and verify payment signatures and webhooks (idempotent). Requester pays after accepting; record payments and a ledger in paise; funds are marked held. Do not release funds yet. Refund path for cancellation before pickup. Never expose secret keys to the app. Explain the settlement model options (Razorpay Route etc.) and what my lawyer/CA must confirm.
Done when: a test payment succeeds, webhook replay does not double-record.

## Phase 6: Handover, delivery and payout (week 7)
Prompt:
> Phase 6 only. Add pickup and delivery with one-time handover codes: traveler enters the code the requester shows to confirm delivery, which moves the request to delivered then settled and releases the traveler's payout minus platform fee (test mode). Add item photos at pickup, 48-hour auto-confirm rule, and a dispute button that freezes payout.
Done when: full happy path and the dispute path work end to end.

## Phase 7: Chat, notifications, ratings (week 8)
Prompt:
> Phase 7 only. Add in-app chat per accepted request (Supabase Realtime, RLS so only the two parties read it, block sharing phone numbers until accepted), push notifications for status changes via Expo notifications, and mutual ratings after settlement.

## Phase 8: Safety, admin and beta (week 9-10)
Prompt:
> Phase 8 only. Add report/block user, an admin dashboard for disputes and verifications, rate limiting on Edge Functions, error tracking (Sentry), analytics events for the funnel, a privacy policy and terms placeholder screens, and EAS builds for an Android internal testing track. Run a security review of RLS and Edge Functions and list every finding.
Done when: 10-20 real friends complete real test deliveries in test-money mode.

## Before public launch (not code)
- Lawyer signs off terms, prohibited list and payment model
- Razorpay live KYC and marketplace settlement approved
- Trademark search for "Hopbag"
- Play Store listing, privacy policy URL, data deletion flow

## Tips for working with Claude Code
- Keep CLAUDE.md up to date; ask Claude to update it at the end of each phase.
- Ask for a plan first on big phases ("plan Phase 5, do not code yet").
- Commit after every working step so you can roll back.
- Test on a real Android phone early and often.
