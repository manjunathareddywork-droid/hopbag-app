-- Phase 8: blocks, reports, suspension, rate limits, error/event logs, admin reports.
-- R = 1111 requester, T = 2222 verified traveler, X = 3333 other user, M = 4444 admin.
begin;

create extension if not exists pgtap with schema extensions;

select plan(56);

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
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Other'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Admin')
) as u (id, name);
update public.profiles set traveler_verified_at = now()
where id = '22222222-2222-2222-2222-222222222222';
insert into public.admins (user_id) values ('44444444-4444-4444-4444-444444444444');

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
  values ('11111111-1111-1111-1111-111111111111', 'spices', 'Garam masala', 500,
          (select id from public.cities where name = 'Bengaluru'),
          (select id from public.cities where name = 'Hyderabad'),
          public.today_ist() + 7, 30000, 20000)
  returning id
)
insert into k select 'rA', id from req;

grant select on k to authenticated, anon, service_role;

set local role authenticated;

-------------------------------------------------------------------------------
-- Blocks
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.user_blocks (blocked_id) values ('22222222-2222-2222-2222-222222222222') $$,
  'requester blocks the traveler');
select throws_ok(
  $$ insert into public.user_blocks (blocked_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '23514', null, 'cannot block yourself');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select id from public.item_requests $$,
  'a blocked traveler no longer sees the requester''s open requests');
select is_empty($$ select * from public.user_blocks $$, 'people cannot see who blocked them');
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select ok(
  not public.is_blocked_between('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  'a third person cannot find out that R blocked T');
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.make_offer((select id from k where name = 'rA'), (select id from k where name = 'trip'), 15000) $$,
  'HB030', null, 'a blocked traveler cannot make an offer');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ delete from public.user_blocks where blocked_id = '22222222-2222-2222-2222-222222222222' $$,
  'requester unblocks');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select isnt_empty($$ select id from public.item_requests $$, 'after unblocking the request is visible again');
select lives_ok(
  $$ select public.make_offer((select id from k where name = 'rA'), (select id from k where name = 'trip'), 15000) $$,
  'traveler offers');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.accept_offer((select id from public.offers limit 1)) $$,
  'requester accepts');
select lives_ok(
  $$ insert into public.user_blocks (blocked_id) values ('22222222-2222-2222-2222-222222222222') $$,
  'requester blocks the traveler mid-deal');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'Hello?') $$,
  'HB030', null, 'blocked people cannot message each other');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ delete from public.user_blocks where blocked_id = '22222222-2222-2222-2222-222222222222' $$,
  'requester unblocks again');

-------------------------------------------------------------------------------
-- Rate limit on chat messages (30 per minute)
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ do $d$
     begin
       for i in 1..30 loop
         insert into public.messages (request_id, body)
         values ((select id from k where name = 'rA'), 'message ' || i);
       end loop;
     end $d$ $$,
  '30 messages in a minute are fine');
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'one more') $$,
  'HB032', null, 'the 31st message in a minute is refused');

-------------------------------------------------------------------------------
-- Reports and suspension
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.user_reports (reported_user_id, category, details)
     values ('22222222-2222-2222-2222-222222222222', 'fraud', 'Asked me to pay outside the app') $$,
  'a user reports someone');
select throws_ok(
  $$ insert into public.user_reports (reported_user_id, category)
     values ('33333333-3333-3333-3333-333333333333', 'other') $$,
  '23514', null, 'cannot report yourself');
select throws_ok(
  $$ insert into public.user_reports (reported_user_id, category)
     values ('22222222-2222-2222-2222-222222222222', 'rude') $$,
  '23514', null, 'report category must be one of the list');
select throws_ok(
  $$ select public.review_report((select id from public.user_reports limit 1), 'ok', true) $$,
  'HB012', null, 'only admins review reports');
select throws_ok(
  $$ select public.set_suspension('22222222-2222-2222-2222-222222222222', true, 'x') $$,
  'HB012', null, 'only admins suspend accounts');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select id from public.user_reports $$, 'people cannot see reports about them');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.user_reports where status = 'open'), 1, 'admin sees open reports');
select lives_ok(
  $$ select public.review_report((select id from public.user_reports limit 1), 'Confirmed, suspending', true) $$,
  'admin reviews the report and suspends');
select throws_ok(
  $$ select public.set_suspension('44444444-4444-4444-4444-444444444444', true) $$,
  'HB010', null, 'admins cannot suspend themselves');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select user_id from public.account_suspensions $$,
  'other people cannot see who is suspended or why');
select ok(not public.is_suspended('22222222-2222-2222-2222-222222222222'),
  'is_suspended cannot be used to probe other people');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok(public.is_suspended('22222222-2222-2222-2222-222222222222'), 'the traveler is suspended');
select is((select reason from public.account_suspensions), 'Confirmed, suspending',
  'the suspended person can see the reason');
select throws_ok(
  $$ insert into public.item_requests
       (category_id, item_name, weight_grams, from_city_id, to_city_id, deadline, budget_paise, item_price_paise)
     select 'books', 'Novel', 500, (select id from public.cities where name = 'Hyderabad'),
            (select id from public.cities where name = 'Bengaluru'), public.today_ist() + 5, 20000, 30000 $$,
  '42501', null, 'a suspended person cannot post requests');
select throws_ok(
  $$ insert into public.trips (from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr, ticket_photo_path)
     select (select id from public.cities where name = 'Hyderabad'), (select id from public.cities where name = 'Bengaluru'),
            public.today_ist() + 4, 'bus', 2000, 1, 'TRIP002', '22222222-2222-2222-2222-222222222222/t2.jpg' $$,
  '42501', null, 'a suspended person cannot add trips');

reset role;
select lives_ok($$ select public.enforce_rate_limit('noop', 1000, 60) $$, 'setup: reset nothing');
-- Reset the message window so the next check is about suspension, not rate.
delete from public.rate_limits where key like 'messages:%';
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.messages (request_id, body) values ((select id from k where name = 'rA'), 'still here') $$,
  'HB031', null, 'a suspended person cannot send messages');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_suspension('22222222-2222-2222-2222-222222222222', false) $$,
  'admin lifts the suspension');
select ok(not public.is_suspended('22222222-2222-2222-2222-222222222222'), 'the traveler can act again');

-------------------------------------------------------------------------------
-- Error and event logs
-------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select lives_ok(
  $$ insert into public.app_errors (kind, message, fingerprint, screen)
     values ('crash', 'Cannot read property x of undefined', 'abc123', 'sign-in') $$,
  'errors before sign-in are recorded');
select throws_ok($$ select id from public.app_errors $$, '42501', null, 'anonymous users cannot read errors');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.app_errors (kind, message, fingerprint) values ('error', 'Network request failed', 'net1') $$,
  'a signed-in user''s error is recorded');
select throws_ok(
  $$ insert into public.app_errors (user_id, kind, message, fingerprint)
     values ('22222222-2222-2222-2222-222222222222', 'error', 'x', 'f') $$,
  '42501', null, 'errors cannot be filed as someone else');
select is_empty($$ select id from public.app_errors $$, 'users cannot read errors');
select lives_ok(
  $$ do $d$ begin
       for i in 1..40 loop
         insert into public.app_errors (kind, message, fingerprint) values ('error', 'loop', 'loop1');
       end loop;
     end $d$ $$,
  'an error loop does not break the app');
select lives_ok(
  $$ insert into public.app_events (name, properties) values ('request_posted', '{"category": "spices"}') $$,
  'events are recorded');
select throws_ok(
  $$ insert into public.app_events (name) values ('anything_goes') $$,
  '23514', null, 'only known event names are accepted');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is(
  (select count(*)::int from public.app_errors where user_id = '33333333-3333-3333-3333-333333333333'),
  30, 'error floods are capped at 30 a minute per user');
select is((select count(*)::int from public.app_events), 1, 'admin reads events');

-------------------------------------------------------------------------------
-- Admin reports
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.admin_dashboard() $$, 'HB012', null, 'only admins see the dashboard');
select throws_ok($$ select * from public.admin_funnel(30) $$, 'HB012', null, 'only admins see the funnel');
select throws_ok($$ select * from public.admin_error_groups(24) $$, 'HB012', null, 'only admins see errors');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((public.admin_dashboard()->>'users')::int, 4, 'dashboard counts users');
select is((public.admin_dashboard()->>'in_progress')::int, 1, 'dashboard counts deliveries in progress');
select is((public.admin_dashboard()->>'errors_24h')::int, 31, 'dashboard counts recent errors (1 anonymous + 30 capped)');
select results_eq(
  $$ select step from public.admin_funnel(30) $$,
  $$ values ('signed_up'), ('requests_posted'), ('got_an_offer'), ('offer_accepted'), ('paid'),
            ('picked_up'), ('completed'), ('rated') $$,
  'funnel has the eight steps in order');
select is(
  (select count from public.admin_funnel(30) where step = 'offer_accepted'), 1::bigint,
  'funnel counts the accepted request');
select is(
  (select occurrences from public.admin_error_groups(24) where fingerprint = 'loop1'), 29::bigint,
  'errors are grouped by fingerprint');

-------------------------------------------------------------------------------
-- Edge Function rate limits (service role)
-------------------------------------------------------------------------------
set local role service_role;
select ok(
  public.hit_rate_limit('create-order:test', 2, 60) and public.hit_rate_limit('create-order:test', 2, 60),
  'calls within the limit are allowed');
select ok(not public.hit_rate_limit('create-order:test', 2, 60), 'the next call over the limit is refused');

set local role authenticated;
select throws_ok($$ select public.hit_rate_limit('x', 1, 60) $$, '42501', null,
  'clients cannot touch rate limit counters');

select * from finish();

rollback;
