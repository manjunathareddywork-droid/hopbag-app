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
- `npm start`: start Expo dev server (scan the QR code with Expo Go)
- `npm run typecheck` / `npm run lint` / `npm test`: the three checks CI runs
- `npm run check`: all three in one go; run before saying a task is done
- `npm run format`: Prettier (Markdown is ignored on purpose)
- `npm run test:db`: pgTAP tests in supabase/tests (needs Docker + `supabase db start`)
- `npx expo install <pkg>`: add packages (picks SDK-compatible versions); never plain `npm install <pkg>`
- `supabase migration new <name>`: new SQL migration in supabase/migrations
- `supabase link --project-ref <ref>` then `supabase db push`: apply migrations to the hosted project

## Layout
- src/app: Expo Router screens only. Tests go in src/__tests__, not src/app (every file there becomes a route).
- src/theme: colours, fonts, spacing. src/i18n/en.ts: every user-facing string.
- src/lib: env, Supabase client, TanStack Query client.
- supabase/migrations, supabase/tests/database (00_rls_guard fails CI if any public table lacks RLS or a policy).
- src/features/<area>: api.ts (Supabase calls), hooks.ts (TanStack Query), schema.ts (zod), components.
- src/lib/database.types.ts is hand-written until a project is linked; then regenerate with `supabase gen types typescript --linked > src/lib/database.types.ts`.
- Auth routing: src/app/_layout.tsx uses Stack.Protected (signed out / no profile / app). Navigation only; RLS is the real access control.
- Expo SDK 57. Testing Library v14: `render` and `fireEvent` are async, always await them. Use `renderWithQuery` from src/test-utils.tsx.
- Read local files (photos, picker/manipulator output) with expo-file-system `new File(uri)`, never `fetch(file://...)`: on Android it can return an error text body without failing.
- Typed routes: if tsc says a new route path is not assignable, run `npx expo start` once to regenerate .expo/types.
- DB rule errors use custom SQLSTATEs (HB001 ... HB014), listed at the top of the item_requests and travelers migrations; the app maps them in src/lib/db-errors.ts. Add new ones in both places.
- Who can carry: `public.trip_can_carry(trip_id)` (verified traveler + approved ticket + active upcoming trip). Phase 4 offers must check it in the database.
- Trip limits (items, grams, days ahead) live in `public.app_settings`, read with `public.setting(key)`; the app reads them too (useSettings). Don't hard-code them.
- ID photos and tickets are in the private `traveler-docs` bucket: owner and admins can read, owners cannot change or delete. Use short signed URLs.
- Offers change only through make_offer / withdraw_offer / accept_offer / decline_offer (security definer). Lock order is trip, then request. accept_offer re-checks trip caps under lock; pending offers do not reserve space.
- Matching is by state pair (exact city matches sorted first); request_feed(trip_id) runs with the caller's rights, so only verified travelers get rows.
- Fare band: public.fare_band(weight) from app_settings (fare_*); src/features/offers/fare.ts must use the same integer maths.
- Requesters never read trips (PNR/ticket); offers carry travel_date and mode copied from the trip.
- Admin screens (src/app/admin) sit behind Stack.Protected on `is_admin()`; review goes through review_verification / review_trip_ticket functions.
- Blocked items: patterns in public.blocked_terms are matched as whole words in both Postgres (`\m...\M`) and JS (`\b...\b`); src/__tests__/blocked-terms.test.ts runs the seeded list through the app matcher. Avoid false positives (e.g. "gold" alone blocks Nescafe Gold).
- Request status changes only through DB functions (cancel_request now; later phases add more). The status trigger enforces the PRODUCT.md lifecycle for everyone.
- Admins: rows in public.admins (add via the SQL editor until Phase 3). Category/city/blocked-term edits are admin-only by RLS.
- CI runs on every branch push; push a branch to check SQL tests before merging (no Docker locally).
- Test phone numbers (local config.toml, and add the same in the hosted dashboard): 919000000001 / 919000000002, OTP 123456.
