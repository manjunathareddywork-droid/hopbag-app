-- Phase 4: offers, fare band, trip caps, visibility, and status changes only
-- through functions.
-- R = 1111 requester, T = 2222 verified traveler, U = 3333 unverified traveler,
-- V = 4444 second verified traveler, X = 5555 bystander.
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

insert into auth.users (id, aud, role, phone) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', '919000000001'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', '919000000002'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', '919000000003'),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', '919000000004'),
  ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', '919000000005');

insert into public.profiles (id, full_name, home_city_id)
select u.id, u.name, (select id from public.cities where name = 'Bengaluru')
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Requester'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Traveler T'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Unverified U'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Traveler V'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Bystander')
) as u (id, name);

update public.profiles set traveler_verified_at = now()
where id in ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');

create temporary table c as
select
  (select id from public.cities where name = 'Bengaluru') as blr,
  (select id from public.cities where name = 'Mysuru') as mys,
  (select id from public.cities where name = 'Hyderabad') as hyd;

-- Trips (inserted as the server, tickets already approved).
create temporary table t (name text primary key, id uuid);
with new_trips as (
  insert into public.trips
    (traveler_id, from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr,
     ticket_photo_path, ticket_status)
  select v.traveler_id::uuid, v.from_city, v.to_city, public.today_ist() + v.days, 'train',
         v.grams, v.items, v.pnr, v.traveler_id || '/ticket.jpg', 'approved'
  from c cross join lateral (values
    ('tT',   '22222222-2222-2222-2222-222222222222', c.blr, c.hyd, 3, 5000, 2, 'TT00001'),
    ('tU',   '33333333-3333-3333-3333-333333333333', c.blr, c.hyd, 3, 5000, 3, 'TU00001'),
    ('tV',   '44444444-4444-4444-4444-444444444444', c.mys, c.hyd, 2, 5000, 3, 'TV00001'),
    ('tRev', '22222222-2222-2222-2222-222222222222', c.hyd, c.blr, 3, 5000, 3, 'TR00001'),
    ('tLate','22222222-2222-2222-2222-222222222222', c.blr, c.hyd, 15, 5000, 3, 'TL00001')
  ) as v (name, traveler_id, from_city, to_city, days, grams, items, pnr)
  returning id, pnr
)
insert into t
select case pnr when 'TT00001' then 'tT' when 'TU00001' then 'tU' when 'TV00001' then 'tV'
                when 'TR00001' then 'tRev' else 'tLate' end, id
from new_trips;

-- Requests from R, plus one of T's own.
create temporary table r (name text primary key, id uuid);
with new_requests as (
  insert into public.item_requests
    (requester_id, category_id, item_name, weight_grams, from_city_id, to_city_id, deadline,
     budget_paise, item_price_paise)
  select v.requester::uuid, v.category, v.item, 1000, v.from_city, c.hyd,
         public.today_ist() + 7, 30000, 40000
  from c cross join lateral (values
    ('rA', '11111111-1111-1111-1111-111111111111', 'coffee_tea', 'Filter coffee', c.blr),
    ('rB', '11111111-1111-1111-1111-111111111111', 'books', 'Kannada novels', c.blr),
    ('rC', '11111111-1111-1111-1111-111111111111', 'spices', 'Mysore spices', c.mys),
    ('rD', '11111111-1111-1111-1111-111111111111', 'chocolates', 'Chocolates', c.blr),
    ('rT', '22222222-2222-2222-2222-222222222222', 'books', 'T own request', c.blr)
  ) as v (name, requester, category, item, from_city)
  returning id, item_name
)
insert into r
select case item_name when 'Filter coffee' then 'rA' when 'Kannada novels' then 'rB'
                      when 'Mysore spices' then 'rC' when 'Chocolates' then 'rD' else 'rT' end, id
from new_requests;

grant select on t, r to authenticated;

-------------------------------------------------------------------------------
-- Fare band
-------------------------------------------------------------------------------
select results_eq(
  $$ select min_paise, max_paise from public.fare_band(1000) $$,
  $$ values (10000, 50000) $$,
  'fare band for 1 kg is Rs 100 to Rs 500');
select results_eq(
  $$ select min_paise, max_paise from public.fare_band(200) $$,
  $$ values (5000, 10000) $$,
  'small items have a Rs 50 floor');

-------------------------------------------------------------------------------
-- Who sees open requests
-------------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select id from public.item_requests $$,
  'unverified users cannot browse requests');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tU'), 20000) $$,
  'HB016', null,
  'unverified traveler cannot make an offer');

set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is_empty($$ select id from public.item_requests $$,
  'a signed-in user who is not a verified traveler sees no requests');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok((select count(*) from public.item_requests where status = 'open') >= 4,
  'verified traveler can browse open requests');

select is(
  (select array_agg(name order by name) from r
   where id in (select id from public.request_feed((select id from t where name = 'tT')))),
  array['rA', 'rB', 'rC', 'rD'],
  'feed for BLR->HYD shows Karnataka->Telangana requests, not T''s own');
select is(
  (select exact_match from public.request_feed((select id from t where name = 'tT'))
   where id = (select id from r where name = 'rC')),
  false,
  'Mysuru request is a state-level match for a Bengaluru trip');
select is_empty(
  $$ select id from public.request_feed((select id from t where name = 'tRev')) $$,
  'reverse-direction trip gets an empty feed');

-------------------------------------------------------------------------------
-- Making offers
-------------------------------------------------------------------------------
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tT'), 9999) $$,
  'HB015', null, 'fare below the band is rejected');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tT'), 50001) $$,
  'HB015', null, 'fare above the band is rejected');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tRev'), 20000) $$,
  'HB017', null, 'trip in the wrong direction cannot offer');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tLate'), 20000) $$,
  'HB017', null, 'trip after the request deadline cannot offer');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rT'), (select id from t where name = 'tT'), 20000) $$,
  'HB019', null, 'cannot offer on your own request');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tV'), 20000) $$,
  'HB011', null, 'cannot offer with someone else''s trip');
select throws_ok(
  $$ insert into public.offers (request_id, trip_id, traveler_id, fare_paise, travel_date, mode)
     select (select id from r where name = 'rA'), (select id from t where name = 'tT'),
            '22222222-2222-2222-2222-222222222222', 20000, current_date, 'train' $$,
  '42501', null, 'offers cannot be inserted directly');

select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tT'), 20000, 'Happy to carry') $$,
  'T offers on rA within the band');
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tT'), 21000) $$,
  '23505', null, 'one pending offer per traveler per request');
select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rB'), (select id from t where name = 'tT'), 20000) $$,
  'T offers on rB');
select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rC'), (select id from t where name = 'tT'), 20000) $$,
  'T offers on rC: pending offers do not use up trip space');
select is(
  (select my_offer_status::text from public.request_feed((select id from t where name = 'tT'))
   where id = (select id from r where name = 'rA')),
  'pending',
  'feed shows T''s own offer status');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rA'), (select id from t where name = 'tV'), 15000) $$,
  'V also offers on rA');
select is((select count(*)::int from public.offers), 1, 'V sees only their own offer');

reset role;
select is((select status::text from public.item_requests where id = (select id from r where name = 'rA')),
  'offered', 'a request with offers is "offered"');
set local role authenticated;

-------------------------------------------------------------------------------
-- Requester sees and accepts
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is_empty($$ select id from public.offers $$, 'bystander sees no offers');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(
  (select count(*)::int from public.offers where request_id = (select id from r where name = 'rA')),
  2, 'requester sees both offers on rA');
select throws_ok(
  $$ update public.item_requests set status = 'accepted' where id = (select id from r where name = 'rA') $$,
  '42501', null, 'requester cannot set status directly');

reset role;
create temporary table o as
select o.id, o.status, tr.name as trip, rq.name as req
from public.offers o join t tr on tr.id = o.trip_id join r rq on rq.id = o.request_id;
grant select on o to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is_empty($$ select id from public.trips $$, 'requester cannot read travelers'' trips (no PNR leak)');

select lives_ok(
  $$ select public.accept_offer((select id from o where trip = 'tT' and req = 'rA')) $$,
  'requester accepts T''s offer on rA');

reset role;
select results_eq(
  $$ select r.status::text, (r.accepted_offer_id = (select id from o where trip = 'tT' and req = 'rA'))
     from public.item_requests r where r.id = (select id from r where name = 'rA') $$,
  $$ values ('accepted', true) $$,
  'rA is accepted with T''s offer');
select is(
  (select status::text from public.offers where id = (select id from o where trip = 'tV' and req = 'rA')),
  'rejected', 'the other offer on rA is turned down');
set local role authenticated;

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$ select public.withdraw_offer((select id from o where trip = 'tV' and req = 'rA')) $$,
  'HB010', null, 'a turned-down offer cannot be withdrawn');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select isnt_empty(
  $$ select id from public.item_requests where id = (select id from r where name = 'rA') $$,
  'T still sees the accepted request they are carrying');
select throws_ok(
  $$ select public.accept_offer((select id from o where trip = 'tT' and req = 'rB')) $$,
  'HB011', null, 'a traveler cannot accept their own offer');

-------------------------------------------------------------------------------
-- Trip caps are enforced at acceptance (tT carries at most 2 items)
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.accept_offer((select id from o where trip = 'tT' and req = 'rB')) $$,
  'second item on tT is accepted');
select throws_ok(
  $$ select public.accept_offer((select id from o where trip = 'tT' and req = 'rC')) $$,
  'HB018', null, 'third item on a 2-item trip is refused at acceptance');

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.make_offer((select id from r where name = 'rD'), (select id from t where name = 'tT'), 20000) $$,
  'HB018', null, 'a full trip cannot make new offers');
select throws_ok(
  $$ select public.cancel_trip((select id from t where name = 'tT')) $$,
  'HB021', null, 'a trip with accepted items cannot be cancelled');

-------------------------------------------------------------------------------
-- Withdraw, decline, cancel
-------------------------------------------------------------------------------
select lives_ok(
  $$ select public.withdraw_offer((select id from o where trip = 'tT' and req = 'rC')) $$,
  'T withdraws the offer on rC');
reset role;
select is((select status::text from public.item_requests where id = (select id from r where name = 'rC')),
  'open', 'rC is open again when its only offer is withdrawn');
set local role authenticated;

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rD'), (select id from t where name = 'tV'), 20000) $$,
  'V offers on rD');

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.decline_offer((select id from public.offers
       where request_id = (select id from r where name = 'rD') and status = 'pending')) $$,
  'requester declines V''s offer on rD');
reset role;
select is((select status::text from public.item_requests where id = (select id from r where name = 'rD')),
  'open', 'rD is open again after declining its only offer');
set local role authenticated;

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$ select public.make_offer((select id from r where name = 'rC'), (select id from t where name = 'tV'), 20000) $$,
  'V offers on rC');
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.cancel_request((select id from r where name = 'rC')) $$,
  'requester cancels rC');
reset role;
select is(
  (select array_agg(distinct status::text) from public.offers where request_id = (select id from r where name = 'rC')),
  array['closed', 'withdrawn'],
  'cancelling a request closes its pending offers');

select * from finish();

rollback;
