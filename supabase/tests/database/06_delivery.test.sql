-- Phase 6: pickup, handover codes, settlement and payout, auto-confirm, disputes.
-- R = 1111 requester, T = 2222 traveler, X = 3333 bystander, M = 4444 admin.
begin;

create extension if not exists pgtap with schema extensions;

select plan(62);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003'),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', '919000000004');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = 'Bengaluru')
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Requester'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Traveler'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Bystander'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Admin')
) as u (id, name);
update public.profiles set traveler_verified_at = now()
where id = '22222222-2222-2222-2222-222222222222';
insert into public.admins (user_id) values ('44444444-4444-4444-4444-444444444444');
update public.app_settings set int_value = 6 where key = 'trip_max_items';

create temporary table k (name text primary key, id uuid);

with trip as (
  insert into public.trips
    (traveler_id, from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr,
     ticket_photo_path, ticket_status)
  values ('22222222-2222-2222-2222-222222222222',
          (select id from public.cities where name = 'Bengaluru'),
          (select id from public.cities where name = 'Hyderabad'),
          public.today_ist() + 3, 'train', 5000, 5, 'TRIP001',
          '22222222-2222-2222-2222-222222222222/t.jpg', 'approved')
  returning id
)
insert into k select 'trip', id from trip;

with reqs as (
  insert into public.item_requests
    (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline,
     budget_paise, item_price_paise)
  select '11111111-1111-1111-1111-111111111111', 'sweets_snacks', v.name, 1000,
         (select id from public.cities where name = 'Bengaluru'),
         (select id from public.cities where name = 'Hyderabad'),
         public.today_ist() + 7, 30000, 40000
  from (values ('rCode'), ('rHand'), ('rConf'), ('rDisp'), ('rRef')) as v (name)
  returning id, item_name
)
insert into k select item_name, id from reqs;

-- Offer, accept and pay for every request (item Rs 400 + fare Rs 200 + fee Rs 20 = Rs 620).
do $$
declare
  req record;
  o public.offers;
begin
  for req in select * from k where name like 'r%' loop
    perform set_config('request.jwt.claims',
      '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
    o := public.make_offer(req.id, (select id from k where name = 'trip'), 20000);
    perform set_config('request.jwt.claims',
      '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    perform public.accept_offer(o.id);
    perform public.record_order_created(req.id, '11111111-1111-1111-1111-111111111111', 'order_' || req.name);
    perform public.record_payment_captured('order_' || req.name, 'pay_' || req.name, 62000);
  end loop;
end;
$$;

grant select on k to authenticated, service_role;

select is(
  (select count(*)::int from public.item_requests where status = 'paid'), 5,
  'setup: five paid requests');

set local role authenticated;

-------------------------------------------------------------------------------
-- Pickup
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rCode'),
       '11111111-1111-1111-1111-111111111111/p.jpg', 1000) $$,
  'HB011', null, 'the requester cannot mark pickup');
select throws_ok(
  $$ select public.issue_handover_code((select id from k where name = 'rCode')) $$,
  'HB010', null, 'no handover code before pickup');
select throws_ok(
  $$ select public.settle_request((select id from k where name = 'rCode'), 'code') $$,
  '42501', null, 'clients cannot settle directly');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.issue_handover_code((select id from k where name = 'rCode')) $$,
  'HB011', null, 'the traveler cannot issue the code');
select throws_ok(
  $$ select public.confirm_delivery_code((select id from k where name = 'rCode'), '123456') $$,
  'HB010', null, 'no delivery before pickup');
select throws_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rCode'),
       '11111111-1111-1111-1111-111111111111/p.jpg', 1000) $$,
  '23514', null, 'pickup photo must be in the traveler''s own folder');
select lives_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rCode'),
       '22222222-2222-2222-2222-222222222222/pickup-1.jpg', 950) $$,
  'traveler marks pickup with photo and weight');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select r.status::text, d.pickup_weight_grams from public.deliveries d
     join public.item_requests r on r.id = d.request_id
     where d.request_id = (select id from k where name = 'rCode') $$,
  $$ values ('picked_up', 950) $$,
  'requester sees the pickup and the real weight');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select request_id from public.deliveries $$, 'bystander sees no deliveries');

-------------------------------------------------------------------------------
-- Handover with the code -> delivered -> settled, payout released
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select ok(
  set_config('test.code', public.issue_handover_code((select id from k where name = 'rCode')), true)
    ~ '^[0-9]{6}$',
  'requester gets a 6-digit code');
select is_empty($$ select request_id from public.handover_codes $$,
  'requester cannot read stored codes');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select request_id from public.handover_codes $$,
  'traveler cannot read stored codes');
select is(
  public.confirm_delivery_code((select id from k where name = 'rCode'), 'abcdef'),
  'wrong_code', 'a wrong code is refused');
select is(
  public.confirm_delivery_code((select id from k where name = 'rCode'), current_setting('test.code')),
  'settled', 'the right code completes delivery');

reset role;
select results_eq(
  $$ select r.status::text, d.delivery_method, d.settled_by
     from public.item_requests r join public.deliveries d on d.request_id = r.id
     where r.id = (select id from k where name = 'rCode') $$,
  $$ values ('settled', 'code', 'code') $$,
  'request is settled by code');
select results_eq(
  $$ select gross_paise, fee_paise, net_paise, status::text from public.payouts
     where request_id = (select id from k where name = 'rCode') $$,
  $$ values (62000, 2000, 60000, 'ready') $$,
  'traveler gets item + full fare; the 10% fee the requester paid goes to Hopbag');
select results_eq(
  $$ select account, amount_paise from public.ledger_entries
     where txn_key like 'release:%'
       and payment_id = (select id from public.payments where razorpay_order_id = 'order_rCode')
     order by account $$,
  $$ values ('held', -62000), ('platform_fee', 2000), ('traveler', 60000) $$,
  'ledger moves the held money to the traveler and the platform fee');
select is(
  (select sum(amount_paise)::int from public.ledger_entries
   where account = 'held'
     and payment_id = (select id from public.payments where razorpay_order_id = 'order_rCode')),
  0, 'nothing is held for this request any more');
select is_empty(
  $$ select request_id from public.handover_codes where request_id = (select id from k where name = 'rCode') $$,
  'the code is deleted after use (one-time)');
set local role authenticated;

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.confirm_delivery_code((select id from k where name = 'rCode'), current_setting('test.code')) $$,
  'HB010', null, 'a used code cannot settle again');
select is((select count(*)::int from public.payouts), 1, 'traveler sees their payout');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is_empty($$ select id from public.payouts $$, 'requester cannot see the traveler''s payout');

-------------------------------------------------------------------------------
-- Wrong codes lock the code; handed over without code; 48 h auto-confirm
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rHand'),
       '22222222-2222-2222-2222-222222222222/pickup-2.jpg', 1000) $$,
  'traveler picks up rHand');
select throws_ok(
  $$ select public.confirm_delivery_code((select id from k where name = 'rHand'), '123456') $$,
  'HB025', null, 'no code issued yet');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select ok(
  set_config('test.code2', public.issue_handover_code((select id from k where name = 'rHand')), true) <> '',
  'requester shows a code for rHand');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.confirm_delivery_code((select id from k where name = 'rHand'), 'x1'), 'wrong_code', 'wrong 1');
select is(public.confirm_delivery_code((select id from k where name = 'rHand'), 'x2'), 'wrong_code', 'wrong 2');
select is(public.confirm_delivery_code((select id from k where name = 'rHand'), 'x3'), 'wrong_code', 'wrong 3');
select is(public.confirm_delivery_code((select id from k where name = 'rHand'), 'x4'), 'wrong_code', 'wrong 4');
select is(public.confirm_delivery_code((select id from k where name = 'rHand'), 'x5'), 'locked',
  'the fifth wrong code locks it');
select is(
  public.confirm_delivery_code((select id from k where name = 'rHand'), current_setting('test.code2')),
  'locked', 'even the right code is refused once locked');

select lives_ok(
  $$ select public.mark_handed_over((select id from k where name = 'rHand')) $$,
  'traveler hands over without a code');

reset role;
select ok(
  (select confirm_by between now() + interval '47 hours' and now() + interval '49 hours'
   from public.deliveries where request_id = (select id from k where name = 'rHand')),
  'requester has 48 hours to confirm or report a problem');
select is(public.auto_confirm_deliveries(), 0, 'nothing auto-confirms before 48 hours');
update public.deliveries set confirm_by = now() - interval '1 minute'
where request_id = (select id from k where name = 'rHand');
select is(public.auto_confirm_deliveries(), 1, 'after 48 hours the handover auto-confirms');
select results_eq(
  $$ select r.status::text, d.settled_by from public.item_requests r
     join public.deliveries d on d.request_id = r.id
     where r.id = (select id from k where name = 'rHand') $$,
  $$ values ('settled', 'auto') $$,
  'auto-confirmed request is settled and paid out');
set local role authenticated;

-------------------------------------------------------------------------------
-- Requester confirms a handover
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rConf'),
       '22222222-2222-2222-2222-222222222222/pickup-3.jpg', 1000) $$,
  'traveler picks up rConf');
select lives_ok(
  $$ select public.mark_handed_over((select id from k where name = 'rConf')) $$,
  'traveler hands over rConf');
select throws_ok(
  $$ select public.confirm_received((select id from k where name = 'rConf')) $$,
  'HB011', null, 'the traveler cannot confirm receipt');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.confirm_received((select id from k where name = 'rConf')) $$,
  'requester confirms receipt');
select is(
  (select status::text from public.item_requests where id = (select id from k where name = 'rConf')),
  'settled', 'confirmed request is settled');

-------------------------------------------------------------------------------
-- Dispute -> admin releases
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.raise_dispute((select id from k where name = 'rDisp'), 'This is not my request at all') $$,
  'HB011', null, 'a bystander cannot open a dispute');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.raise_dispute((select id from k where name = 'rDisp'), 'bad') $$,
  'HB027', null, 'a dispute needs a short description');
select lives_ok(
  $$ select public.raise_dispute((select id from k where name = 'rDisp'), 'Traveler is not answering my calls') $$,
  'requester reports a problem');
select throws_ok(
  $$ select public.raise_dispute((select id from k where name = 'rCode'), 'Item was damaged when I opened it') $$,
  'HB010', null, 'a settled request cannot be disputed');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rDisp'),
       '22222222-2222-2222-2222-222222222222/pickup-4.jpg', 1000) $$,
  'HB010', null, 'a disputed request is frozen');
select is((select count(*)::int from public.disputes), 1, 'the traveler sees the dispute');
select throws_ok(
  $$ select public.resolve_dispute_release((select id from k where name = 'rDisp'), 'ok') $$,
  'HB012', null, 'only admins resolve disputes');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select id from public.disputes $$, 'a bystander sees no disputes');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$ select public.resolve_dispute_release((select id from k where name = 'rDisp'), 'Traveler showed proof of delivery') $$,
  'admin releases the payout');

reset role;
select results_eq(
  $$ select r.status::text, d.status::text, d.resolution, p.net_paise
     from public.item_requests r
     join public.disputes d on d.request_id = r.id
     join public.payouts p on p.request_id = r.id
     where r.id = (select id from k where name = 'rDisp') $$,
  $$ values ('settled', 'resolved', 'released', 60000) $$,
  'released dispute: settled with payout');

-------------------------------------------------------------------------------
-- Dispute -> admin refunds (resolve-dispute-refund Edge Function, service role)
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.mark_picked_up((select id from k where name = 'rRef'),
       '22222222-2222-2222-2222-222222222222/pickup-5.jpg', 1000) $$,
  'traveler picks up rRef');
select lives_ok(
  $$ select public.raise_dispute((select id from k where name = 'rRef'), 'Shop was closed, item is not what was asked') $$,
  'the traveler can report a problem too');

set local role service_role;
select throws_ok(
  $$ select public.admin_refund_quote((select id from k where name = 'rRef'),
       '11111111-1111-1111-1111-111111111111') $$,
  'HB012', null, 'only an admin can refund a dispute');
select is(
  (select razorpay_payment_id from public.admin_refund_quote(
     (select id from k where name = 'rRef'), '44444444-4444-4444-4444-444444444444')),
  'pay_rRef', 'admin can refund the disputed payment');
select lives_ok(
  $$ select public.record_refund_requested(
       (select id from public.payments where razorpay_order_id = 'order_rRef'), 'rfnd_rRef') $$,
  'refund request is recorded');
select lives_ok(
  $$ select public.record_refund_processed('pay_rRef', 'rfnd_rRef', 62000) $$,
  'refund.processed is recorded');
select lives_ok(
  $$ select public.close_dispute_refunded((select id from k where name = 'rRef'),
       '44444444-4444-4444-4444-444444444444', 'Refunded: item not as asked') $$,
  'the dispute is closed as refunded');

reset role;
select results_eq(
  $$ select r.status::text, p.status::text, d.resolution
     from public.item_requests r
     join public.payments p on p.request_id = r.id
     join public.disputes d on d.request_id = r.id
     where r.id = (select id from k where name = 'rRef') $$,
  $$ values ('refunded', 'refunded', 'refunded') $$,
  'refunded dispute: request and payment refunded');
select is_empty(
  $$ select id from public.payouts where request_id = (select id from k where name = 'rRef') $$,
  'no payout for a refunded request');
select is((select sum(amount_paise)::int from public.ledger_entries), 0,
  'the whole ledger stays balanced');

select * from finish();

rollback;
