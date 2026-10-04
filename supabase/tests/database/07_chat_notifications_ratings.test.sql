-- Phase 7: phone-number blocking, chat access, notifications, push claims, ratings.
-- R = 1111 requester, T = 2222 chosen traveler, V = 3333 traveler not chosen,
-- X = 4444 bystander, M = 5555 admin.
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003'),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', '919000000004'),
  ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', '919000000005');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = 'Bengaluru')
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Asha Requester'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Bala Traveler'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Vinay Traveler'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Bystander'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Admin')
) as u (id, name);
update public.profiles set traveler_verified_at = now()
where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
insert into public.admins (user_id) values ('55555555-5555-5555-5555-555555555555');

create temporary table k (name text primary key, id uuid);

with trips as (
  insert into public.trips
    (traveler_id, from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr,
     ticket_photo_path, ticket_status)
  select v.traveler::uuid,
         (select id from public.cities where name = 'Bengaluru'),
         (select id from public.cities where name = 'Hyderabad'),
         public.today_ist() + 3, 'train', 5000, 3, v.pnr, v.traveler || '/t.jpg', 'approved'
  from (values ('22222222-2222-2222-2222-222222222222', 'TRIPT01'),
               ('33333333-3333-3333-3333-333333333333', 'TRIPV01')) as v (traveler, pnr)
  returning id, pnr
)
insert into k select case pnr when 'TRIPT01' then 'tripT' else 'tripV' end, id from trips;

with reqs as (
  insert into public.item_requests
    (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline,
     budget_paise, item_price_paise)
  select '11111111-1111-1111-1111-111111111111', 'sweets_snacks', v.name, 1000,
         (select id from public.cities where name = 'Bengaluru'),
         (select id from public.cities where name = 'Hyderabad'),
         public.today_ist() + 7, 30000, 40000
  from (values ('rA'), ('rB'), ('rS')) as v (name)
  returning id, item_name
)
insert into k select item_name, id from reqs;

-- rA: T and V offer, R accepts T (not paid yet).
-- rS: T carries it all the way to settled.
do $$
declare
  o public.offers;
  code text;
  rA uuid := (select id from k where name = 'rA');
  rS uuid := (select id from k where name = 'rS');
begin
  perform set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
  perform public.make_offer(rA, (select id from k where name = 'tripV'), 20000);
  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  o := public.make_offer(rA, (select id from k where name = 'tripT'), 20000);
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  perform public.accept_offer(o.id);

  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  o := public.make_offer(rS, (select id from k where name = 'tripT'), 20000);
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  perform public.accept_offer(o.id);
  perform public.record_order_created(rS, '11111111-1111-1111-1111-111111111111', 'order_rS');
  perform public.record_payment_captured('order_rS', 'pay_rS', 62000);
  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  perform public.mark_picked_up(rS, '22222222-2222-2222-2222-222222222222/p.jpg', 1000);
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  code := public.issue_handover_code(rS);
  perform set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
  perform public.confirm_delivery_code(rS, code);
end;
$$;

grant select on k to authenticated, service_role;

-------------------------------------------------------------------------------
-- Phone number detection
-------------------------------------------------------------------------------
select ok(public.contains_phone_number('call me on 98765 43210'), 'spaced number is found');
select ok(public.contains_phone_number('+91-98765-43210 anytime'), '+91 with dashes is found');
select ok(public.contains_phone_number('my number 09876543210'), 'leading 0 is found');
select ok(public.contains_phone_number('(987) 654.3210'), 'brackets and dots are found');
select ok(not public.contains_phone_number('Train 12627 on 10/10, 2 kg, Rs 450'),
  'train numbers, dates and prices are fine');
select ok(not public.contains_phone_number('PNR 1234567890'), 'a 10-digit PNR starting with 1 is fine');

set local role authenticated;

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.make_offer((select id from k where name = 'rB'), (select id from k where name = 'tripV'),
       20000, 'WhatsApp me on 98765 43210') $$,
  'HB028', null, 'phone numbers are blocked in offers');

-------------------------------------------------------------------------------
-- Chat: only the two people, open while in progress, phone numbers after payment
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Hi! When are you free?') $$,
  'the chosen traveler can write');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Thanks, paying now') $$,
  'the requester can write');
select is((select count(*)::int from public.messages), 2, 'the requester reads the conversation');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Call 98765 43210') $$,
  'HB028', null, 'phone numbers are blocked before payment');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rB'), 'Anyone?') $$,
  '42501', null, 'no chat before an offer is accepted');
select throws_ok(
  $$ insert into public.messages (request_id, sender_id, body)
     values ((select id from k where name = 'rA'), '22222222-2222-2222-2222-222222222222', 'Fake') $$,
  '42501', null, 'cannot write as someone else');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select id from public.messages $$, 'a traveler who was not chosen cannot read');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Pick me') $$,
  '42501', null, 'a traveler who was not chosen cannot write');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is_empty($$ select id from public.messages $$, 'a bystander cannot read');

set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is((select count(*)::int from public.messages where request_id = (select id from k where name = 'rA')),
  2, 'admins can read chats (for disputes)');

reset role;
select lives_ok(
  $$ select public.record_order_created((select id from k where name = 'rA'),
       '11111111-1111-1111-1111-111111111111', 'order_rA');
     $$,
  'setup: order for rA');
select lives_ok($$ select public.record_payment_captured('order_rA', 'pay_rA', 62000) $$,
  'setup: rA is paid');
set local role authenticated;

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Call me on 98765 43210 at the station') $$,
  'phone numbers are allowed after payment');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rS'), 'Thanks again') $$,
  '42501', null, 'chat closes once the request is completed');

-------------------------------------------------------------------------------
-- Notifications
-------------------------------------------------------------------------------
select ok(
  (select count(*) from public.notifications where kind = 'offer_received') >= 2,
  'requester is told about new offers');
select ok(
  (select bool_and(user_id = '11111111-1111-1111-1111-111111111111') from public.notifications),
  'requester sees only their own notifications');
select is(
  (select params->>'name' from public.notifications where kind = 'message' order by id limit 1),
  'Bala', 'message notification names the sender');
select lives_ok(
  $$ update public.notifications set read_at = now() where kind = 'offer_received' $$,
  'requester marks notifications read');
select throws_ok(
  $$ update public.notifications set kind = 'refunded' $$,
  '42501', null, 'notifications cannot be rewritten');
select throws_ok(
  $$ insert into public.notifications (user_id, kind) values ('22222222-2222-2222-2222-222222222222', 'message') $$,
  '42501', null, 'notifications cannot be created by users');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select kind from public.notifications
     where kind in ('offer_accepted', 'request_paid', 'payout_unlocked') order by kind $$,
  $$ values ('offer_accepted'), ('offer_accepted'), ('payout_unlocked'), ('request_paid'), ('request_paid') $$,
  'traveler is told about acceptance, payment and payout');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is(
  (select kind from public.notifications where request_id = (select id from k where name = 'rA')),
  'offer_not_chosen', 'the other traveler is told they were not chosen');

-------------------------------------------------------------------------------
-- Push tokens and delivery claims
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[device-1]', 'android') $$,
  'a device registers its push token');
select throws_ok(
  $$ select public.register_push_token('not-a-token', 'android') $$,
  '23514', null, 'only Expo push tokens are accepted');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[device-1]', 'android') $$,
  'another person signing in on the same phone takes over the token');
select is((select count(*)::int from public.push_tokens), 1, 'the token now belongs to T');
select throws_ok($$ select * from public.claim_push_batch(10) $$, '42501', null,
  'users cannot claim push deliveries');

set local role service_role;
select ok(
  (select bool_or(tokens = array['ExponentPushToken[device-1]'])
   from public.claim_push_batch(1000)
   where user_id = '22222222-2222-2222-2222-222222222222'),
  'push claim includes the device token for T''s notifications');
select is((select count(*)::int from public.claim_push_batch(1000)), 0,
  'claimed notifications are not pushed twice');
set local role authenticated;

-------------------------------------------------------------------------------
-- Ratings
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rA'), 5) $$,
  'HB010', null, 'no rating before the delivery is completed');
select lives_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rS'), 5, 'Quick and careful') $$,
  'requester rates the traveler');
select throws_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rS'), 4) $$,
  '23505', null, 'one rating per person per delivery');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rS'), 1) $$,
  'HB011', null, 'a bystander cannot rate');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rS'), 6) $$,
  '23514', null, 'stars are 1 to 5');
select lives_ok(
  $$ select public.rate_counterpart((select id from k where name = 'rS'), 4) $$,
  'traveler rates the requester');
select is(
  (select kind from public.notifications where kind = 'rated'),
  'rated', 'the traveler is told they were rated');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select results_eq(
  $$ select average, count from public.rating_summary(array[
       '22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid])
     order by average desc $$,
  $$ values (5.0::numeric, 1), (4.0::numeric, 1) $$,
  'ratings are public: averages for both people');

select * from finish();

rollback;
