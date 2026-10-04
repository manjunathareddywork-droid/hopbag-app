-- Phase 2: reference data access, allowlist and status rules on item_requests.
-- A = 1111... (requester), B = 2222... (other user), M = 3333... (admin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = u.city)
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Asha Rao', 'Bengaluru'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Bala Reddy', 'Hyderabad'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Admin', 'Bengaluru')
) as u (id, name, city);

insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333');

-- City ids used below (looked up as postgres before switching roles).
create temporary table ids as
select
  (select id from public.cities where name = 'Hyderabad') as hyd,
  (select id from public.cities where name = 'Bengaluru') as blr,
  (select id from public.cities where name = 'Mysuru') as mys;
grant select on ids to authenticated, anon;

-- Shorthand for a valid request (as SQL text) with one field overridden.
create function pg_temp.req(
  item text default 'Filter coffee powder',
  details text default '',
  category text default 'coffee_tea',
  grams integer default 1000,
  from_city text default 'hyd',
  to_city text default 'blr',
  deadline_days integer default 7,
  budget integer default 50000
) returns text language sql as $$
  select format(
    'insert into public.item_requests
       (category_id, item_name, details, weight_grams, from_city_id, to_city_id, deadline,
        budget_paise, item_price_paise)
     select %L, %L, %L, %s, ids.%I, ids.%I, public.today_ist() + %s, %s, 40000 from ids',
    category, item, details, grams, from_city, to_city, deadline_days, budget
  );
$$;
grant execute on function pg_temp.req to authenticated, anon;

-------------------------------------------------------------------------------
-- Reference data
-------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from public.allowed_categories $$, '42501', null,
  'anon cannot read categories');
select throws_ok($$ select * from public.cities $$, '42501', null,
  'anon cannot read cities');
select throws_ok(pg_temp.req(), '42501', null,
  'anon cannot create requests');

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok((select count(*) from public.allowed_categories where is_active) >= 10,
  'signed-in users can read the category allowlist');
select ok((select count(*) from public.cities) >= 100,
  'signed-in users can read cities');
select ok((select count(*) from public.blocked_terms) > 0,
  'signed-in users can read blocked terms');
select is((select public.is_admin()), false, 'A is not an admin');

select is_empty(
  $$ update public.allowed_categories set max_weight_grams = 5000 where id = 'cosmetics' returning id $$,
  'non-admin cannot edit a category');
select throws_ok(
  $$ insert into public.allowed_categories (id, name, max_weight_grams) values ('phones', 'Phones', 500) $$,
  '42501', null,
  'non-admin cannot add a category');
select is_empty(
  $$ delete from public.blocked_terms returning id $$,
  'non-admin cannot remove blocked terms');
select is_empty($$ select * from public.admins $$,
  'non-admin cannot see the admin list');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is((select public.is_admin()), true, 'M is an admin');
select lives_ok(
  $$ insert into public.allowed_categories (id, name, max_weight_grams) values ('tea_kits', 'Tea kits', 1000) $$,
  'admin can add a category');
select lives_ok(
  $$ update public.allowed_categories set is_active = false where id = 'toys' $$,
  'admin can deactivate a category');

-------------------------------------------------------------------------------
-- Creating requests: allowlist and rules are enforced in the database
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(pg_temp.req(), 'A can create a valid request');
select is(
  (select requester_id::text || ' ' || status::text from public.item_requests),
  '11111111-1111-1111-1111-111111111111 open',
  'new request belongs to A and starts open');

select throws_ok(pg_temp.req(item => 'Paracetamol tablets'), 'HB001', null,
  'blocked item in the name is rejected');
select throws_ok(pg_temp.req(details => 'please add 2 bottles of whisky'), 'HB001', null,
  'blocked item in the details is rejected');
select throws_ok(pg_temp.req(item => 'GOLD CHAIN for my sister'), 'HB001', null,
  'blocked terms match regardless of case');
select lives_ok(pg_temp.req(item => 'Nescafe Gold coffee'), 'brand names containing gold are fine');
select lives_ok(pg_temp.req(item => 'Ginger candy', category => 'sweets_snacks'),
  'words that only start with a blocked term are fine (ginger vs gin)');

select throws_ok(pg_temp.req(category => 'phones_unknown'), 'HB002', null,
  'unknown category is rejected');
select throws_ok(pg_temp.req(category => 'toys', item => 'Wooden top'), 'HB002', null,
  'inactive category is rejected');
select throws_ok(pg_temp.req(category => 'cosmetics', item => 'Face cream', grams => 1500), 'HB003', null,
  'item heavier than the category limit is rejected');
select throws_ok(pg_temp.req(category => 'books', item => 'Encyclopedia set', grams => 6000), 'HB003', null,
  'item over 5 kg is rejected (no category allows more)');
select throws_ok(pg_temp.req(from_city => 'mys'), 'HB004', null,
  'same-state route is rejected (Mysuru to Bengaluru)');
select throws_ok(pg_temp.req(from_city => 'blr'), 'HB004', null,
  'same pickup and delivery city is rejected');
select throws_ok(pg_temp.req(deadline_days => 0), 'HB005', null,
  'deadline today is rejected');
select throws_ok(pg_temp.req(deadline_days => 21), 'HB005', null,
  'deadline more than 20 days out is rejected');
select lives_ok(pg_temp.req(deadline_days => 20, item => 'Mysore Pak', category => 'sweets_snacks'),
  'deadline exactly 20 days out is accepted');
select throws_ok(pg_temp.req(budget => 4999), '23514', null,
  'budget below Rs 50 is rejected');

select throws_ok(
  $$ insert into public.item_requests
       (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline, budget_paise)
     select '22222222-2222-2222-2222-222222222222', 'books', 'Novel', 500, hyd, blr, public.today_ist() + 7, 30000
     from ids $$,
  '42501', null,
  'A cannot create a request on behalf of B');

select throws_ok(
  $$ update public.item_requests set status = 'settled' $$,
  '42501', null,
  'A cannot set status directly');

select throws_ok(
  $$ update public.item_requests set item_name = 'Whisky' where item_name = 'Filter coffee powder' $$,
  'HB001', null,
  'editing a request into a blocked item is rejected');

-------------------------------------------------------------------------------
-- Visibility and cancelling
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty($$ select id from public.item_requests $$, 'B cannot see A''s requests');
select throws_ok(
  $$ select public.cancel_request((select id from public.item_requests limit 1)) $$,
  'HB011', null,
  'B finds no request of A''s to cancel');

reset role;
create temporary table target as
  select id from public.item_requests where item_name = 'Filter coffee powder';
grant select on target to authenticated;
set local role authenticated;

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.cancel_request((select id from target)) $$,
  'HB011', null,
  'B cannot cancel A''s request');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(
  (select status::text from public.cancel_request((select id from target))),
  'cancelled',
  'A can cancel their open request');
select throws_ok(
  $$ select public.cancel_request((select id from target)) $$,
  'HB010', null,
  'a cancelled request cannot be cancelled again');

-------------------------------------------------------------------------------
-- Status machine (as postgres, the way later phases' functions will act)
-------------------------------------------------------------------------------
reset role;

select throws_ok(
  $$ update public.item_requests set status = 'open' where id = (select id from target) $$,
  'HB010', null,
  'cancelled is final, even for the server');

select ok(public.request_transition_allowed('paid', 'picked_up'), 'paid -> picked_up is allowed');
select ok(not public.request_transition_allowed('open', 'paid'), 'open -> paid is not allowed');

-- Expiry job: an open request whose deadline has passed becomes expired.
-- The validation trigger rejects past deadlines, so skip it to set up the row.
alter table public.item_requests disable trigger item_requests_validate;
update public.item_requests set deadline = public.today_ist() - 1
where item_name = 'Nescafe Gold coffee';
alter table public.item_requests enable trigger item_requests_validate;

select is(public.expire_overdue_requests(), 1, 'expiry job expires one overdue request');
select is(
  (select status::text from public.item_requests where item_name = 'Nescafe Gold coffee'),
  'expired',
  'the overdue request is now expired');

select * from finish();

rollback;
