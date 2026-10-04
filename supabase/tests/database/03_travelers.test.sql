-- Phase 3: settings, identity verification, trips, admin review, trip_can_carry.
-- A = 1111... (traveler), B = 2222... (other user), M = 3333... (admin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

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

create temporary table ids as
select
  (select id from public.cities where name = 'Hyderabad') as hyd,
  (select id from public.cities where name = 'Bengaluru') as blr,
  (select id from public.cities where name = 'Mysuru') as mys;
grant select on ids to authenticated;

-- A trip insert (as SQL text) with one field overridden.
create function pg_temp.trip(
  from_city text default 'blr',
  to_city text default 'hyd',
  days_ahead integer default 5,
  grams integer default 3000,
  items integer default 2,
  pnr text default '4521367890',
  ticket text default '11111111-1111-1111-1111-111111111111/ticket-1.jpg'
) returns text language sql as $$
  select format(
    'insert into public.trips
       (from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr, ticket_photo_path)
     select ids.%I, ids.%I, public.today_ist() + %s, ''train'', %s, %s, %L, %L from ids',
    from_city, to_city, days_ahead, grams, items, pnr, ticket
  );
$$;
grant execute on function pg_temp.trip to authenticated;

-------------------------------------------------------------------------------
-- Settings
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(public.setting('trip_max_items'), 3, 'default trip limit is 3 items');
select is(public.setting('trip_max_grams'), 5000, 'default trip limit is 5 kg');
select is_empty(
  $$ update public.app_settings set int_value = 10 where key = 'trip_max_items' returning key $$,
  'non-admin cannot change settings');

-------------------------------------------------------------------------------
-- Identity verification
-------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.traveler_verifications (id_type, id_photo_path)
     values ('aadhaar', '11111111-1111-1111-1111-111111111111/id-1.jpg') $$,
  'A can submit an ID for verification');
select is(
  (select status::text from public.traveler_verifications),
  'pending',
  'a new verification is pending');
select throws_ok(
  $$ insert into public.traveler_verifications (id_type, id_photo_path)
     values ('pan', '11111111-1111-1111-1111-111111111111/id-2.jpg') $$,
  'HB013', null,
  'A cannot submit a second ID while one is pending');
select throws_ok(
  $$ insert into public.traveler_verifications (id_type, id_photo_path, status)
     values ('pan', '11111111-1111-1111-1111-111111111111/id-3.jpg', 'approved') $$,
  '42501', null,
  'A cannot submit an already-approved verification');
select throws_ok(
  $$ update public.profiles set traveler_verified_at = now()
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'A cannot give themselves the verified badge');
select throws_ok(
  $$ select public.review_verification(
       (select id from public.traveler_verifications limit 1), true) $$,
  'HB012', null,
  'A cannot review their own verification');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty($$ select id from public.traveler_verifications $$,
  'B cannot see A''s verification');
select throws_ok(
  $$ insert into public.traveler_verifications (id_type, id_photo_path)
     values ('pan', '11111111-1111-1111-1111-111111111111/id-9.jpg') $$,
  '23514', null,
  'B cannot point a verification at A''s files');

-------------------------------------------------------------------------------
-- Trips
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(pg_temp.trip(), 'A can add a valid trip');
select is(
  (select ticket_status::text || ' ' || status::text from public.trips),
  'pending active',
  'a new trip is active with its ticket pending review');
select throws_ok(pg_temp.trip(from_city => 'mys', to_city => 'blr'), 'HB004', null,
  'same-state trip is rejected');
select throws_ok(pg_temp.trip(days_ahead => -1), 'HB006', null,
  'trip in the past is rejected');
select throws_ok(pg_temp.trip(days_ahead => 61), 'HB006', null,
  'trip more than 60 days ahead is rejected');
select throws_ok(pg_temp.trip(grams => 6000), 'HB007', null,
  'trip over 5 kg is rejected');
select throws_ok(pg_temp.trip(items => 4), 'HB007', null,
  'trip over 3 items is rejected');
select throws_ok(pg_temp.trip(pnr => 'pnr 12'), '23514', null,
  'badly formed PNR is rejected');
select throws_ok(
  pg_temp.trip(ticket => '22222222-2222-2222-2222-222222222222/ticket.jpg'),
  '23514', null,
  'ticket photo must be in the traveler''s own folder');
select throws_ok(
  $$ update public.trips set ticket_status = 'approved' $$,
  '42501', null,
  'A cannot approve their own ticket');

reset role;
create temporary table trip1 as select id from public.trips;
grant select on trip1 to authenticated;
set local role authenticated;

select is(public.trip_can_carry((select id from trip1)), false,
  'unverified traveler with a pending ticket cannot carry');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty($$ select id from public.trips $$, 'B cannot see A''s trips');
select throws_ok($$ select public.cancel_trip((select id from trip1)) $$, 'HB011', null,
  'B cannot cancel A''s trip');

-------------------------------------------------------------------------------
-- Admin review
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is((select count(*)::int from public.traveler_verifications), 1,
  'admin can see verifications');
select is((select count(*)::int from public.trips), 1, 'admin can see trips');

select lives_ok($$ select public.review_trip_ticket((select id from trip1), true) $$,
  'admin approves the ticket');
select is(public.trip_can_carry((select id from trip1)), false,
  'approved ticket alone is not enough: traveler is not verified');

select throws_ok(
  $$ select public.review_verification(
       (select id from public.traveler_verifications limit 1), false, '') $$,
  'HB014', null,
  'rejecting needs a reason');
select lives_ok(
  $$ select public.review_verification(
       (select id from public.traveler_verifications limit 1), true) $$,
  'admin approves the ID');
select ok(
  (select traveler_verified_at is not null from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'approved traveler gets the verified badge');
select is(public.trip_can_carry((select id from trip1)), true,
  'verified traveler with an approved ticket can carry');
select throws_ok(
  $$ select public.review_verification(
       (select id from public.traveler_verifications limit 1), false, 'second look') $$,
  'HB010', null,
  'a reviewed verification cannot be reviewed again');

select lives_ok(
  $$ update public.app_settings set int_value = 5 where key = 'trip_max_items' $$,
  'admin can change the trip item limit');

-------------------------------------------------------------------------------
-- Traveler after review
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(public.is_verified_traveler('11111111-1111-1111-1111-111111111111'), true,
  'A is now a verified traveler');
select throws_ok(
  $$ insert into public.traveler_verifications (id_type, id_photo_path)
     values ('pan', '11111111-1111-1111-1111-111111111111/id-4.jpg') $$,
  'HB013', null,
  'a verified traveler cannot resubmit');
select is_empty(
  $$ update public.trips set capacity_grams = 1000 where id = (select id from trip1) returning id $$,
  'an approved trip cannot be edited');
select lives_ok(pg_temp.trip(items => 4, pnr => 'AB12CD'),
  'raised item limit applies to new trips');

reset role;
create temporary table trip2 as select id from public.trips where pnr = 'AB12CD';
grant select on trip2 to authenticated;
set local role authenticated;

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.review_trip_ticket((select id from trip2), false, 'Ticket photo is blurry') $$,
  'admin rejects a ticket with a reason');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ update public.trips set ticket_photo_path = '11111111-1111-1111-1111-111111111111/ticket-2.jpg'
     where id = (select id from trip2) $$,
  'traveler can upload a new ticket after rejection');
select is(
  (select ticket_status::text || coalesce(ticket_reject_reason, '') from public.trips
   where id = (select id from trip2)),
  'pending',
  'a new ticket goes back to pending review');

select is(
  (select status::text from public.cancel_trip((select id from trip1))),
  'cancelled',
  'A can cancel their trip');
select is(public.trip_can_carry((select id from trip1)), false,
  'a cancelled trip cannot carry');

-------------------------------------------------------------------------------
-- Traveler documents bucket
-------------------------------------------------------------------------------
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('traveler-docs', '11111111-1111-1111-1111-111111111111/id-1.jpg') $$,
  'A can upload into their own documents folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('traveler-docs', '22222222-2222-2222-2222-222222222222/id-1.jpg') $$,
  '42501', null,
  'A cannot upload into B''s documents folder');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty(
  $$ select id from storage.objects where bucket_id = 'traveler-docs' $$,
  'B cannot see A''s ID photo');

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'traveler-docs'),
  1,
  'admin can see traveler documents');

select * from finish();

rollback;
