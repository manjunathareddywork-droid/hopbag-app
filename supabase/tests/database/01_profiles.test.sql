-- RLS and constraint tests for states, profiles and the avatars bucket.
-- Users: A = 1111..., B = 2222... Acting as a user = role authenticated + JWT sub.
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002');

-------------------------------------------------------------------------------
-- Anonymous visitors
-------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  (select count(*) from public.states)::int, 36,
  'anon can read the states list'
);

select throws_ok(
  $$ insert into public.states (code, name) values ('ZZ', 'Nowhere') $$,
  '42501', null,
  'anon cannot add states'
);

select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null,
  'anon cannot read profiles'
);

-------------------------------------------------------------------------------
-- User A creates a profile
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.states (code, name) values ('ZZ', 'Nowhere') $$,
  '42501', null,
  'signed-in users cannot add states'
);

select lives_ok(
  $$ insert into public.profiles (id, full_name, home_state, home_city)
     values ('11111111-1111-1111-1111-111111111111', 'Asha Rao', 'KA', 'Bengaluru') $$,
  'A can create their own profile'
);

select throws_ok(
  $$ insert into public.profiles (id, full_name, home_state, home_city)
     values ('22222222-2222-2222-2222-222222222222', 'Fake B', 'KA', 'Bengaluru') $$,
  '42501', null,
  'A cannot create a profile for B'
);

-------------------------------------------------------------------------------
-- User B creates a profile
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.profiles (id, full_name, home_state, home_city)
     values ('22222222-2222-2222-2222-222222222222', 'Bala Reddy', 'TS', 'Hyderabad') $$,
  'B can create their own profile'
);

-------------------------------------------------------------------------------
-- A reads and edits
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bala Reddy',
  'A can read B''s public profile'
);

select is_empty(
  $$ update public.profiles set full_name = 'Hacked'
     where id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'A cannot update B''s profile'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Asha R', home_city = 'Mysuru'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'A can update their own profile'
);

select is(
  (select home_city from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Mysuru',
  'A''s update was saved'
);

select throws_ok(
  $$ update public.profiles set created_at = now() - interval '1 year'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'A cannot change created_at'
);

select throws_ok(
  $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'A cannot change their profile id'
);

select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'A cannot delete profiles'
);

-------------------------------------------------------------------------------
-- Constraints (enforced in the database, not just the form)
-------------------------------------------------------------------------------
select throws_ok(
  $$ update public.profiles set full_name = 'A'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'name shorter than 2 characters is rejected'
);

select throws_ok(
  $$ update public.profiles set full_name = '  Asha  '
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'name with surrounding spaces is rejected'
);

select throws_ok(
  $$ update public.profiles set home_state = 'XX'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23503', null,
  'unknown state is rejected'
);

select throws_ok(
  $$ update public.profiles set avatar_path = '22222222-2222-2222-2222-222222222222/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'avatar path outside the user''s own folder is rejected'
);

select lives_ok(
  $$ update public.profiles set avatar_path = '11111111-1111-1111-1111-111111111111/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'avatar path in the user''s own folder is accepted'
);

-------------------------------------------------------------------------------
-- Avatars bucket
-------------------------------------------------------------------------------
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.jpg') $$,
  'A can upload to their own avatar folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.jpg') $$,
  '42501', null,
  'A cannot upload into B''s avatar folder'
);

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*) from storage.objects
   where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg')::int,
  1,
  'B can see A''s avatar'
);

select is_empty(
  $$ update storage.objects set name = '22222222-2222-2222-2222-222222222222/stolen.jpg'
     where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg'
     returning id $$,
  'B cannot modify A''s avatar'
);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is_empty(
  $$ select id from storage.objects where bucket_id = 'avatars' $$,
  'anon cannot see avatars'
);

select * from finish();

rollback;
