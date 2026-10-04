-- Phase 5: payments and ledger. Edge Functions act as service_role.
-- R = 1111 requester, T = 2222 verified traveler, X = 3333 bystander.
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = 'Bengaluru')
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Requester'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Traveler'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Bystander')
) as u (id, name);
update public.profiles set traveler_verified_at = now()
where id = '22222222-2222-2222-2222-222222222222';

create temporary table k (name text primary key, id uuid);

with trip as (
  insert into public.trips
    (traveler_id, from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr,
     ticket_photo_path, ticket_status)
  values ('22222222-2222-2222-2222-222222222222',
          (select id from public.cities where name = 'Bengaluru'),
          (select id from public.cities where name = 'Hyderabad'),
          public.today_ist() + 3, 'bus', 5000, 3, 'TRIP001',
          '22222222-2222-2222-2222-222222222222/t.jpg', 'approved')
  returning id
)
insert into k select 'trip', id from trip;

with req as (
  insert into public.item_requests
    (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline,
     budget_paise, item_price_paise)
  select '11111111-1111-1111-1111-111111111111', 'sweets_snacks', v.item, 1000,
         (select id from public.cities where name = 'Bengaluru'),
         (select id from public.cities where name = 'Hyderabad'),
         public.today_ist() + 7, 30000, 40000
  from (values ('Mysore Pak'), ('Second item')) as v (item)
  returning id, item_name
)
insert into k select case item_name when 'Mysore Pak' then 'req' else 'req2' end, id from req;

grant select on k to authenticated, service_role;

-- Offer and accept through the real functions.
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.make_offer((select id from k where name = 'req'), (select id from k where name = 'trip'), 20000) $$, 'traveler offers Rs 200');
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.accept_offer((select id from public.offers limit 1)) $$, 'requester accepts');

-------------------------------------------------------------------------------
-- Clients cannot touch payment functions or tables
-------------------------------------------------------------------------------
select throws_ok(
  $$ select public.record_payment_captured('order_x', 'pay_x', 60000) $$,
  '42501', null, 'a signed-in user cannot mark a payment captured');
select throws_ok(
  $$ select * from public.payment_quote((select id from k where name = 'req'),
                                        '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'a signed-in user cannot call payment_quote directly');
select throws_ok(
  $$ insert into public.payments (request_id, offer_id, requester_id, traveler_id,
       item_price_paise, fare_paise, amount_paise, razorpay_order_id)
     select (select id from k where name = 'req'), (select id from public.offers limit 1),
       '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
       1, 1, 2, 'order_fake' $$,
  '42501', null, 'payments cannot be inserted by clients');
select throws_ok(
  $$ update public.item_requests set item_price_paise = null
     where id = (select id from k where name = 'req2') $$,
  '23502', null, 'item price cannot be removed');

-------------------------------------------------------------------------------
-- Quote and order (as the create-order Edge Function)
-------------------------------------------------------------------------------
set local role service_role;

select throws_ok(
  $$ select * from public.payment_quote((select id from k where name = 'req'),
                                        '33333333-3333-3333-3333-333333333333') $$,
  'HB011', null, 'only the requester can pay');
select throws_ok(
  $$ select * from public.payment_quote((select id from k where name = 'req2'),
                                        '11111111-1111-1111-1111-111111111111') $$,
  'HB022', null, 'a request without an accepted offer cannot be paid');
select results_eq(
  $$ select item_price_paise, fare_paise, amount_paise, existing_order_id
     from public.payment_quote((select id from k where name = 'req'),
                               '11111111-1111-1111-1111-111111111111') $$,
  $$ values (40000, 20000, 60000, null::text) $$,
  'amount is item price + fare, in paise');

select lives_ok(
  $$ select public.record_order_created((select id from k where name = 'req'),
       '11111111-1111-1111-1111-111111111111', 'order_test_1') $$,
  'order is recorded');
select hasnt_function('public', 'record_payment_failed', array['text'],
  'a failed attempt has no way to mark the order failed (the requester can retry it)');
select is(
  (select existing_order_id from public.payment_quote((select id from k where name = 'req'),
                                                       '11111111-1111-1111-1111-111111111111')),
  'order_test_1',
  'an unpaid order is reused instead of creating another');

-------------------------------------------------------------------------------
-- Capture (verify-payment Edge Function and payment.captured webhook)
-------------------------------------------------------------------------------
select throws_ok(
  $$ select public.record_payment_captured('order_test_1', 'pay_test_1', 59999) $$,
  'HB023', null, 'amount mismatch is rejected');
select throws_ok(
  $$ select public.record_payment_captured('order_unknown', 'pay_test_1', 60000) $$,
  'HB023', null, 'unknown order is rejected');
select lives_ok(
  $$ select public.record_payment_captured('order_test_1', 'pay_test_1', 60000) $$,
  'payment is captured');
select is(
  (select status::text from public.payments where razorpay_order_id = 'order_test_1'),
  'captured', 'payment is marked captured (held by Razorpay)');
reset role; -- checks on tables the Edge Functions never read directly
select is(
  (select status::text from public.item_requests where id = (select id from k where name = 'req')),
  'paid', 'request moves to paid');
set local role service_role;
select results_eq(
  $$ select account, amount_paise from public.ledger_entries order by account $$,
  $$ values ('held', 60000), ('requester', -60000) $$,
  'ledger: 60000 paise held, balanced against the requester');

select lives_ok(
  $$ select public.record_payment_captured('order_test_1', 'pay_test_1', 60000) $$,
  'replaying the same capture is accepted');
select is((select count(*)::int from public.ledger_entries), 2,
  'replayed capture does not post again');
select throws_ok(
  $$ select public.record_payment_captured('order_test_1', 'pay_other', 60000) $$,
  'HB023', null, 'a second, different payment for the same order is rejected');

select lives_ok(
  $$ insert into public.webhook_events (event_id, event_type, payload)
     values ('evt_1', 'payment.captured', '{}') $$,
  'first delivery of a webhook event is stored');
select is_empty(
  $$ insert into public.webhook_events (event_id, event_type, payload)
     values ('evt_1', 'payment.captured', '{}')
     on conflict (event_id) do nothing returning event_id $$,
  'a replayed webhook event is recognised as already seen');

-- As the table owner, so this proves the trigger, not just a missing grant.
reset role;
select throws_ok(
  $$ delete from public.ledger_entries $$,
  'P0001', null, 'ledger entries cannot be deleted, even by the owner');
select throws_ok(
  $$ update public.ledger_entries set amount_paise = 1 $$,
  'P0001', null, 'ledger entries cannot be changed, even by the owner');
set local role service_role;

-------------------------------------------------------------------------------
-- Who can see payments
-------------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.payments), 1, 'requester sees their payment');
select is_empty($$ select id from public.ledger_entries $$, 'requester cannot read the ledger');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.payments), 1, 'traveler sees the payment held for them');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select id from public.payments $$, 'bystander sees no payments');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.cancel_request((select id from k where name = 'req')) $$,
  'HB010', null, 'a paid request is cancelled through the refund flow, not cancel_request');

-------------------------------------------------------------------------------
-- Refund before pickup
-------------------------------------------------------------------------------
set local role service_role;

select throws_ok(
  $$ select public.refund_quote((select id from k where name = 'req'),
                                '33333333-3333-3333-3333-333333333333') $$,
  'HB011', null, 'only the requester can ask for a refund');
select is(
  (select razorpay_payment_id from public.refund_quote((select id from k where name = 'req'),
                                                      '11111111-1111-1111-1111-111111111111')),
  'pay_test_1', 'requester can get a refund before pickup');

select lives_ok(
  $$ select public.record_refund_requested(
       (select id from public.payments where razorpay_order_id = 'order_test_1'), 'rfnd_1') $$,
  'refund request is recorded');
reset role;
select results_eq(
  $$ select p.status::text, r.status::text, o.status::text
     from public.payments p
     join public.item_requests r on r.id = p.request_id
     join public.offers o on o.id = p.offer_id
     where p.razorpay_order_id = 'order_test_1' $$,
  $$ values ('refund_pending', 'refunded', 'closed') $$,
  'refund pending: request refunded, offer closed so trip space is freed');
set local role service_role;

select throws_ok(
  $$ select public.record_refund_processed('pay_test_1', 'rfnd_1', 30000) $$,
  'HB023', null, 'partial refund amounts are rejected');
select lives_ok(
  $$ select public.record_refund_processed('pay_test_1', 'rfnd_1', 60000) $$,
  'refund.processed is recorded');
select is(
  (select status::text from public.payments where razorpay_order_id = 'order_test_1'),
  'refunded', 'payment is refunded');
select is(
  (select sum(amount_paise)::int from public.ledger_entries where account = 'held'),
  0, 'nothing is held after the refund');
select lives_ok(
  $$ select public.record_refund_processed('pay_test_1', 'rfnd_1', 60000) $$,
  'replaying refund.processed is accepted');
select is((select count(*)::int from public.ledger_entries), 4,
  'replayed refund does not post again');
select is((select sum(amount_paise)::int from public.ledger_entries), 0,
  'the ledger stays balanced');
select throws_ok(
  $$ select public.refund_quote((select id from k where name = 'req'),
                                '11111111-1111-1111-1111-111111111111') $$,
  'HB024', null, 'a refunded request cannot be refunded again');

select * from finish();

rollback;
