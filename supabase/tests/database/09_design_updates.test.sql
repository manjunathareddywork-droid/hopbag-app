-- Redesign changes: requester-paid fee, decline at pickup, upcoming trips, profile
-- stats, intent and preferences, route alerts, rating tags, dispute categories,
-- chat photos, phone after payment, support and deletion requests.
-- R = 1111 requester (Hyderabad, TS), T = 2222 verified traveler, X = 3333 other.
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = u.city)
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Arjun Mehta', 'Hyderabad'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Sneha Iyer', 'Chennai'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Xavier', 'Bengaluru')
) as u (id, name, city);
update public.profiles set traveler_verified_at = now()
where id = '22222222-2222-2222-2222-222222222222';

create temporary table k (name text primary key, id uuid);

with trip as (
  insert into public.trips
    (traveler_id, from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr,
     ticket_photo_path, ticket_status)
  values ('22222222-2222-2222-2222-222222222222',
          (select id from public.cities where name = 'Chennai'),
          (select id from public.cities where name = 'Hyderabad'),
          public.today_ist() + 4, 'flight', 4500, 3, 'TRIP001',
          '22222222-2222-2222-2222-222222222222/t.jpg', 'approved')
  returning id
)
insert into k select 'trip', id from trip;

grant select on k to authenticated, service_role;

-------------------------------------------------------------------------------
-- Upcoming trips, names and stats
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(public.display_name('22222222-2222-2222-2222-222222222222'), 'Sneha I.',
  'lists show first name and initial');
select is(public.display_name('33333333-3333-3333-3333-333333333333'), 'Xavier',
  'single names stay as they are');
select results_eq(
  $$ select traveler_name, free_grams, free_items from public.upcoming_trips() $$,
  $$ values ('Sneha I.', 4500, 3) $$,
  'a requester sees verified trips coming to their state');
select is_empty($$ select id from public.trips $$,
  'the trips table itself (with the PNR) stays private');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select * from public.upcoming_trips() $$,
  'someone in another state does not see trips that are not coming their way');
select results_eq($$ select count(*)::int from public.upcoming_trips('TS') $$, $$ values (1) $$,
  'trips into a state can be looked up by state');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select * from public.upcoming_trips('TS') $$,
  'travelers do not see their own trips in the list');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.user_blocks (blocked_id) values ('22222222-2222-2222-2222-222222222222') $$,
  'setup: requester blocks the traveler');
select is_empty($$ select * from public.upcoming_trips() $$, 'blocked travelers are hidden');
select lives_ok($$ delete from public.user_blocks $$, 'setup: unblock');

select results_eq(
  $$ select display_name, verified, deliveries, disputes from public.profile_stats('22222222-2222-2222-2222-222222222222') $$,
  $$ values ('Sneha I.', true, 0, 0) $$,
  'public profile stats for a traveler');

-------------------------------------------------------------------------------
-- Intent and preferences
-------------------------------------------------------------------------------
select lives_ok(
  $$ update public.profiles set intent = 'both', offer_alerts = false
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'people set what they want to do and their alerts');
select throws_ok(
  $$ update public.profiles set intent = 'sell' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'intent is one of get, carry, both');

-------------------------------------------------------------------------------
-- Route alerts, fee, payment and confirm without the code
-------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.item_requests
       (category_id, item_name, weight_grams, from_city_id, to_city_id, deadline, budget_paise, item_price_paise)
     select 'coffee_tea', 'Filter coffee powder', 500, (select id from public.cities where name = 'Chennai'),
            (select id from public.cities where name = 'Hyderabad'), public.today_ist() + 8, 20000, 32000 $$,
  'requester posts a request on the traveler''s route');

reset role;
insert into k select 'req', id from public.item_requests where item_name = 'Filter coffee powder';
select is(
  (select count(*)::int from public.notifications
   where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'route_request'),
  1, 'travelers with a matching trip are alerted about the new request');
select is(public.platform_fee(18000), 1800, 'Hopbag fee is 10% of the fare');

do $$
declare o public.offers;
begin
  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  o := public.make_offer((select id from k where name = 'req'), (select id from k where name = 'trip'), 18000);
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  perform public.accept_offer(o.id);
end $$;

select results_eq(
  $$ select item_price_paise, fare_paise, fee_paise, amount_paise
     from public.payment_quote((select id from k where name = 'req'), '11111111-1111-1111-1111-111111111111') $$,
  $$ values (32000, 18000, 1800, 51800) $$,
  'Rs 320 item + Rs 180 fare + Rs 18 fee = Rs 518 (as in the designs)');
select lives_ok(
  $$ select public.record_order_created((select id from k where name = 'req'),
       '11111111-1111-1111-1111-111111111111', 'order_req') $$,
  'order created');
select lives_ok($$ select public.record_payment_captured('order_req', 'pay_req', 51800) $$,
  'payment of Rs 518 captured');

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.counterpart_phone((select id from k where name = 'req')), '+919000000002',
  'after payment the requester can see the traveler''s phone');
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is(public.counterpart_phone((select id from k where name = 'req')), null,
  'nobody else can');

-------------------------------------------------------------------------------
-- Chat photos
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.messages (request_id, body, photo_path)
     values ((select id from k where name = 'req'), '', '22222222-2222-2222-2222-222222222222/bill.jpg') $$,
  'a photo-only message is allowed');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'req'), '') $$,
  '23514', null, 'an empty message is not');
select throws_ok(
  $$ insert into public.messages (request_id, body, photo_path)
     values ((select id from k where name = 'req'), '', '11111111-1111-1111-1111-111111111111/x.jpg') $$,
  '23514', null, 'chat photos must be the sender''s own uploads');

-------------------------------------------------------------------------------
-- Pickup: confirm without code; decline path quote
-------------------------------------------------------------------------------
set local role service_role;
select is(
  (select razorpay_payment_id from public.decline_pickup_quote((select id from k where name = 'req'),
                                                               '22222222-2222-2222-2222-222222222222')),
  'pay_req', 'the traveler may decline before pickup');
select throws_ok(
  $$ select public.decline_pickup_quote((select id from k where name = 'req'),
       '11111111-1111-1111-1111-111111111111') $$,
  'HB011', null, 'only the traveler can decline at pickup');
set local role authenticated;

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.mark_picked_up((select id from k where name = 'req'),
       '22222222-2222-2222-2222-222222222222/p.jpg', 500) $$,
  'traveler marks pickup');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.confirm_received((select id from k where name = 'req')) $$,
  'requester confirms "I received my item" without waiting for a handover');

reset role;
select results_eq(
  $$ select r.status::text, p.net_paise, p.fee_paise from public.item_requests r
     join public.payouts p on p.request_id = r.id where r.id = (select id from k where name = 'req') $$,
  $$ values ('settled', 50000, 1800) $$,
  'traveler gets Rs 500 (item + full fare); Hopbag keeps the Rs 18 fee');
select is((select sum(amount_paise)::int from public.ledger_entries), 0, 'the ledger stays balanced');
set local role authenticated;

-------------------------------------------------------------------------------
-- Ratings with tags
-------------------------------------------------------------------------------
select lives_ok(
  $$ select public.rate_counterpart((select id from k where name = 'req'), 5, '', array['on_time', 'great_shape']) $$,
  'requester rates with quick tags');
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.rate_counterpart((select id from k where name = 'req'), 5, '', array['rude']) $$,
  '23514', null, 'only known tags are accepted');

-------------------------------------------------------------------------------
-- Disputes: category and photos
-------------------------------------------------------------------------------
reset role;
insert into public.item_requests
  (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline,
   budget_paise, item_price_paise, status)
select '11111111-1111-1111-1111-111111111111', 'books', 'Tamil novels', 1000,
       (select id from public.cities where name = 'Chennai'),
       (select id from public.cities where name = 'Hyderabad'), public.today_ist() + 9, 20000, 30000, 'open';
insert into k select 'req2', id from public.item_requests where item_name = 'Tamil novels';
do $$
declare o public.offers;
begin
  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  o := public.make_offer((select id from k where name = 'req2'), (select id from k where name = 'trip'), 20000);
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  perform public.accept_offer(o.id);
  perform public.record_order_created((select id from k where name = 'req2'), '11111111-1111-1111-1111-111111111111', 'order_req2');
  perform public.record_payment_captured('order_req2', 'pay_req2', 52000);
end $$;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.raise_dispute((select id from k where name = 'req2'), '', 'damaged',
       array['22222222-2222-2222-2222-222222222222/a.jpg']) $$,
  'HB010', null, 'dispute photos must be the reporter''s own uploads');
select throws_ok(
  $$ select public.raise_dispute((select id from k where name = 'req2'), 'short', 'other') $$,
  'HB027', null, '"something else" needs a description');
select lives_ok(
  $$ select public.raise_dispute((select id from k where name = 'req2'), '', 'not_responding',
       array['11111111-1111-1111-1111-111111111111/a.jpg']) $$,
  'a chosen category needs no description');
select is(
  (select category from public.disputes where request_id = (select id from k where name = 'req2')),
  'not_responding', 'the category is saved');

-------------------------------------------------------------------------------
-- Support and account deletion
-------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.support_messages (body) values ('How long do refunds take?') $$,
  'people can write to support');
select lives_ok(
  $$ insert into public.account_deletion_requests (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  'people can ask to delete their account');
select throws_ok(
  $$ insert into public.account_deletion_requests (user_id) values ('33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'not for someone else');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select id from public.support_messages $$, 'support messages are private');

-------------------------------------------------------------------------------
-- Chat photos are kept while a dispute is open, deleted 7 days after the end
-------------------------------------------------------------------------------
reset role;
-- Back-date the finished request (the updated_at trigger would undo it).
alter table public.item_requests disable trigger item_requests_set_updated_at;
update public.item_requests set updated_at = now() - interval '8 days'
where id = (select id from k where name = 'req');
alter table public.item_requests enable trigger item_requests_set_updated_at;
set local role service_role;
select results_eq(
  $$ select photo_path from public.chat_photos_due(10) $$,
  $$ values ('22222222-2222-2222-2222-222222222222/bill.jpg') $$,
  'chat photos are due for deletion 7 days after the request finished');
set local role authenticated;
select throws_ok($$ select * from public.chat_photos_due(10) $$, '42501', null,
  'only the server can list photos to delete');

select * from finish();

rollback;
