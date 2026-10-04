# Hopbag

Peer-to-peer app: someone requests an item from another Indian state, a traveler already making that trip carries it for a fee. Phase 1 is India inter-state only (lawyer confirmed legal). Global comes later, only if Phase 1 works and has users.

Read docs/PRODUCT.md for rules and docs/PHASES.md for the build plan. Work on ONE phase at a time; do not start the next phase until I say so.

## Stack
- Expo (React Native, TypeScript, Expo Router) for iOS + Android
- Supabase: Postgres, Auth (phone OTP), Storage, Row Level Security, Edge Functions
- Razorpay in TEST mode only until I say otherwise
- State/data: TanStack Query + supabase-js. Forms: react-hook-form + zod
- Tests: Jest + React Native Testing Library; SQL policy tests for RLS

## Rules
- Every table has RLS on. Never ship a table without policies and a test for them.
- Secrets only in .env / Supabase secrets. Never commit keys. Razorpay secret and service role key never go in the app.
- Money in paise (integers). Never floats.
- Business rules (allowlist, item cap, status transitions) are enforced in the database or Edge Functions, not only in the UI.
- Small commits, one concern each. Run typecheck, lint and tests before saying a task is done.
- Ask me before adding a new paid service or a big dependency.
- Keep screens simple: Hopbag users are everyday people, many on low-end Android phones. Support English first; keep strings in one i18n file so Hindi and Telugu can be added.

## Brand
- Deep Teal #0E3B43, Orange #F28E2B, Off-white #F7F9F9
- Orange is for shapes/accents only, never text on light backgrounds (contrast 2.4:1)
- Font: Outfit 600 for the wordmark; DM Sans for app text
- Logo files: assets/brand (from hopbag-logo-kit.zip)

## Commands
(filled in during Phase 0)
