# Hopbag product rules (Phase 1: India inter-state)

## Roles
- Requester: posts an item request (what, from which city, deadline, budget).
- Traveler: posts a trip (from city, to city, date, ticket/PNR). Offers to carry requests on that route.
- Admin: reviews traveler verification, allowlist, disputes.
One account can be both.

## Hard rules
1. Only items on the allowlist can be requested (food and packaged goods like coffee, chocolate, spices, books, clothes, cosmetics under limits). Everything else is blocked at creation, in the database.
2. Never allowed: medicines, alcohol, tobacco, cash, jewellery, electronics with batteries beyond limits, anything restricted by airlines/railways/law, anything sealed that the traveler cannot inspect.
3. Traveler must be verified (phone OTP + ID photo + ticket/PNR for the trip) before they can accept a request. Admin approves in Phase 1.
4. Traveler can open and inspect the item before accepting handover. Requester sees the item photo and weight.
5. Per-traveler per-trip item cap: max 3 requests and max 5 kg total (adjustable in config).
6. Payment is held until delivery is confirmed with a handover code, then released to the traveler minus platform fee.
7. Fares are agreed between the two users but must be inside a min/max band per kg shown in the app.
8. Hopbag is a marketplace, not a courier. Terms must say so; get lawyer review before public launch.

## Request status
draft -> open -> offered -> accepted -> paid (held) -> picked_up -> delivered -> settled
Side exits: cancelled, expired, disputed, refunded.

## Open items to settle with the lawyer before public launch
- Payment holding model (Razorpay Route / marketplace settlement) and platform fee GST handling
- Terms of service, liability, prohibited items list, KYC level for travelers
