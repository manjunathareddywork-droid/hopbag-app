-- Phase 4: offers. Travelers offer to carry open requests on their route; the
-- requester accepts one. Every status change goes through the functions below.
--
-- New error codes:
--   HB015 fare outside the band (detail "min,max")   HB016 trip cannot carry
--   HB017 trip does not match the request's route/deadline
--   HB018 trip is full (detail "items left,grams left")
--   HB019 cannot offer on your own request           HB021 trip has accepted items

-------------------------------------------------------------------------------
-- Fare band (PRODUCT.md rule 7). Placeholders; admins can change them.
-------------------------------------------------------------------------------
insert into public.app_settings (key, int_value, description) values
  ('fare_min_per_kg_paise', 10000, 'Lowest fare per kg, in paise'),
  ('fare_max_per_kg_paise', 50000, 'Highest fare per kg, in paise'),
  ('fare_floor_paise', 5000, 'Lowest fare for any item, in paise');

/** Allowed fare for an item of this weight, rounded up to the paisa. */
create function public.fare_band(weight_grams integer)
returns table (min_paise integer, max_paise integer)
language sql
stable
set search_path = ''
as $$
  select
    greatest(
      public.setting('fare_floor_paise'),
      ((weight_grams::bigint * public.setting('fare_min_per_kg_paise') + 999) / 1000)::integer
    ),
    greatest(
      public.setting('fare_floor_paise'),
      ((weight_grams::bigint * public.setting('fare_max_per_kg_paise') + 999) / 1000)::integer
    );
$$;

revoke execute on function public.fare_band(integer) from public, anon;
grant execute on function public.fare_band(integer) to authenticated;

-------------------------------------------------------------------------------
-- Offers
-------------------------------------------------------------------------------
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'closed');

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.item_requests (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  traveler_id uuid not null references public.profiles (id) on delete cascade,
  fare_paise integer not null check (fare_paise > 0),
  message text not null default '' check (message = btrim(message) and char_length(message) <= 300),
  -- Copied from the trip so requesters never need to read trips (PNR, ticket).
  travel_date date not null,
  mode public.travel_mode not null,
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index offers_one_pending_per_traveler
  on public.offers (request_id, traveler_id) where status = 'pending';
create index offers_request_idx on public.offers (request_id, created_at);
create index offers_trip_accepted_idx on public.offers (trip_id) where status = 'accepted';
create index offers_traveler_idx on public.offers (traveler_id, created_at desc);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

alter table public.item_requests
  add column accepted_offer_id uuid references public.offers (id);

-------------------------------------------------------------------------------
-- Visibility helpers. security definer so policies on item_requests and offers
-- can refer to each other without recursing through RLS.
-------------------------------------------------------------------------------
create function public.owns_request(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.item_requests
    where id = request_id and requester_id = (select auth.uid())
  );
$$;

create function public.has_offer_on(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.offers o
    where o.request_id = has_offer_on.request_id and o.traveler_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_request(uuid) from public, anon;
revoke execute on function public.has_offer_on(uuid) from public, anon;
grant execute on function public.owns_request(uuid) to authenticated;
grant execute on function public.has_offer_on(uuid) to authenticated;

alter table public.offers enable row level security;

revoke all on public.offers from anon, authenticated;
grant select on public.offers to authenticated;
-- No insert/update grants: offers change only through the functions below.

create policy "Travelers see their offers, requesters see offers on their requests"
  on public.offers for select
  to authenticated
  using (
    traveler_id = (select auth.uid())
    or public.owns_request(request_id)
    or (select public.is_admin())
  );

-- Verified travelers can browse open requests; travelers keep seeing requests
-- they offered on (including after acceptance).
create policy "Verified travelers see open requests"
  on public.item_requests for select
  to authenticated
  using (
    status in ('open', 'offered')
    and public.is_verified_traveler((select auth.uid()))
  );

create policy "Travelers see requests they offered on"
  on public.item_requests for select
  to authenticated
  using (public.has_offer_on(id));

-- Request photos: visible to anyone who can see the request.
create policy "People who can see a request can see its photo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-photos'
    and exists (select 1 from public.item_requests r where r.photo_path = storage.objects.name)
  );

-------------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-------------------------------------------------------------------------------

/** Accepted items and grams on a trip. */
create function public.trip_load(p_trip_id uuid, out items integer, out grams integer)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer, coalesce(sum(r.weight_grams), 0)::integer
  from public.offers o
  join public.item_requests r on r.id = o.request_id
  where o.trip_id = p_trip_id and o.status = 'accepted';
$$;

/** offered -> open when the last pending offer goes away. */
create function public.reopen_if_no_pending_offers(p_request_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.item_requests r
  set status = 'open'
  where r.id = p_request_id
    and r.status = 'offered'
    and not exists (
      select 1 from public.offers o where o.request_id = p_request_id and o.status = 'pending'
    );
$$;

revoke execute on function public.trip_load(uuid) from public, anon, authenticated;
revoke execute on function public.reopen_if_no_pending_offers(uuid) from public, anon, authenticated;

/** Raises HB017/HB018 unless the request fits this trip's route, date and space. */
create function public.check_trip_fits(trip public.trips, request public.item_requests)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  load record;
begin
  if (select state_code from public.cities where id = request.from_city_id)
       <> (select state_code from public.cities where id = trip.from_city_id)
    or (select state_code from public.cities where id = request.to_city_id)
       <> (select state_code from public.cities where id = trip.to_city_id)
    or trip.travel_date > request.deadline
  then
    raise exception 'Trip does not match this request' using errcode = 'HB017';
  end if;

  select * into load from public.trip_load(trip.id);
  if load.items + 1 > trip.max_items or load.grams + request.weight_grams > trip.capacity_grams then
    raise exception 'Trip is full'
      using errcode = 'HB018',
        detail = (trip.max_items - load.items) || ',' || (trip.capacity_grams - load.grams);
  end if;
end;
$$;

revoke execute on function public.check_trip_fits(public.trips, public.item_requests)
  from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Traveler: make / withdraw an offer
-------------------------------------------------------------------------------
create function public.make_offer(
  p_request_id uuid,
  p_trip_id uuid,
  p_fare_paise integer,
  p_message text default ''
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip public.trips;
  request public.item_requests;
  band record;
  offer public.offers;
begin
  -- Lock order everywhere: trip, then request.
  select * into trip from public.trips where id = p_trip_id for update;
  if not found or trip.traveler_id is distinct from (select auth.uid()) then
    raise exception 'Trip not found' using errcode = 'HB011';
  end if;
  if not public.trip_can_carry(p_trip_id) then
    raise exception 'Trip cannot carry items yet' using errcode = 'HB016';
  end if;

  select * into request from public.item_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if request.requester_id = (select auth.uid()) then
    raise exception 'Cannot offer on your own request' using errcode = 'HB019';
  end if;
  if request.status not in ('open', 'offered') then
    raise exception 'Request is no longer open' using errcode = 'HB010';
  end if;

  perform public.check_trip_fits(trip, request);

  select * into band from public.fare_band(request.weight_grams);
  if p_fare_paise is null or p_fare_paise < band.min_paise or p_fare_paise > band.max_paise then
    raise exception 'Fare must be between % and % paise', band.min_paise, band.max_paise
      using errcode = 'HB015', detail = band.min_paise || ',' || band.max_paise;
  end if;

  insert into public.offers (request_id, trip_id, traveler_id, fare_paise, message, travel_date, mode)
  values (
    p_request_id, p_trip_id, trip.traveler_id, p_fare_paise, btrim(coalesce(p_message, '')),
    trip.travel_date, trip.mode
  )
  returning * into offer;

  if request.status = 'open' then
    update public.item_requests set status = 'offered' where id = p_request_id;
  end if;

  return offer;
end;
$$;

create function public.withdraw_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer public.offers;
begin
  select * into offer from public.offers where id = p_offer_id for update;
  if not found or offer.traveler_id is distinct from (select auth.uid()) then
    raise exception 'Offer not found' using errcode = 'HB011';
  end if;
  if offer.status <> 'pending' then
    raise exception 'Offer is no longer pending' using errcode = 'HB010';
  end if;

  update public.offers set status = 'withdrawn' where id = p_offer_id returning * into offer;
  perform public.reopen_if_no_pending_offers(offer.request_id);
  return offer;
end;
$$;

-------------------------------------------------------------------------------
-- Requester: accept / decline an offer
-------------------------------------------------------------------------------
create function public.accept_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer public.offers;
  trip public.trips;
  request public.item_requests;
begin
  select * into offer from public.offers where id = p_offer_id;
  if not found then
    raise exception 'Offer not found' using errcode = 'HB011';
  end if;

  select * into trip from public.trips where id = offer.trip_id for update;
  select * into request from public.item_requests where id = offer.request_id for update;
  if request.requester_id is distinct from (select auth.uid()) then
    raise exception 'Offer not found' using errcode = 'HB011';
  end if;

  -- Re-read under the locks.
  select * into offer from public.offers where id = p_offer_id for update;
  if offer.status <> 'pending' or request.status <> 'offered' then
    raise exception 'Offer is no longer available' using errcode = 'HB010';
  end if;
  if not public.trip_can_carry(trip.id) then
    raise exception 'Traveler can no longer carry on this trip' using errcode = 'HB016';
  end if;

  perform public.check_trip_fits(trip, request);

  update public.offers set status = 'accepted' where id = p_offer_id returning * into offer;
  update public.offers set status = 'rejected'
  where request_id = request.id and id <> p_offer_id and status = 'pending';
  update public.item_requests
  set status = 'accepted', accepted_offer_id = p_offer_id
  where id = request.id;

  return offer;
end;
$$;

create function public.decline_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer public.offers;
begin
  select * into offer from public.offers where id = p_offer_id for update;
  if not found or not public.owns_request(offer.request_id) then
    raise exception 'Offer not found' using errcode = 'HB011';
  end if;
  if offer.status <> 'pending' then
    raise exception 'Offer is no longer pending' using errcode = 'HB010';
  end if;

  update public.offers set status = 'rejected' where id = p_offer_id returning * into offer;
  perform public.reopen_if_no_pending_offers(offer.request_id);
  return offer;
end;
$$;

revoke execute on function public.make_offer(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.withdraw_offer(uuid) from public, anon;
revoke execute on function public.accept_offer(uuid) from public, anon;
revoke execute on function public.decline_offer(uuid) from public, anon;
grant execute on function public.make_offer(uuid, uuid, integer, text) to authenticated;
grant execute on function public.withdraw_offer(uuid) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Existing actions now also tidy up offers
-------------------------------------------------------------------------------

-- Requesters can cancel before payment (draft/open/offered/accepted); open offers close.
create or replace function public.cancel_request(request_id uuid)
returns public.item_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.item_requests;
begin
  select * into request from public.item_requests where id = request_id for update;
  if not found or request.requester_id is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if request.status not in ('draft', 'open', 'offered', 'accepted') then
    raise exception 'Request can no longer be cancelled' using errcode = 'HB010';
  end if;

  update public.offers set status = 'closed'
  where offers.request_id = cancel_request.request_id and status in ('pending', 'accepted');
  update public.item_requests set status = 'cancelled'
  where id = cancel_request.request_id
  returning * into request;
  return request;
end;
$$;

create or replace function public.expire_overdue_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  with expired as (
    update public.item_requests
    set status = 'expired'
    where status in ('open', 'offered') and deadline < public.today_ist()
    returning id
  ),
  closed as (
    update public.offers o set status = 'closed'
    from expired e
    where o.request_id = e.id and o.status = 'pending'
    returning o.id
  )
  select count(*) into affected from expired;
  return affected;
end;
$$;

-- A trip with accepted items cannot be cancelled here (handled with disputes in
-- Phase 6). Pending offers from the trip are withdrawn.
create or replace function public.cancel_trip(trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip public.trips;
  pending record;
begin
  select * into trip from public.trips where id = trip_id for update;
  if not found or trip.traveler_id is distinct from (select auth.uid()) then
    raise exception 'Trip not found' using errcode = 'HB011';
  end if;
  if trip.status <> 'active' then
    raise exception 'Trip is not active' using errcode = 'HB010';
  end if;
  if exists (
    select 1 from public.offers o where o.trip_id = cancel_trip.trip_id and o.status = 'accepted'
  ) then
    raise exception 'Trip has accepted items' using errcode = 'HB021';
  end if;

  for pending in
    update public.offers o set status = 'withdrawn'
    where o.trip_id = cancel_trip.trip_id and o.status = 'pending'
    returning o.request_id
  loop
    perform public.reopen_if_no_pending_offers(pending.request_id);
  end loop;

  update public.trips set status = 'cancelled' where id = cancel_trip.trip_id returning * into trip;
  return trip;
end;
$$;

-------------------------------------------------------------------------------
-- Route feed for a trip: open requests between the same states, needed on or
-- after the travel date. Exact city matches first. Runs with the caller's
-- rights, so only verified travelers get rows (item_requests RLS).
-------------------------------------------------------------------------------
create function public.request_feed(p_trip_id uuid)
returns table (
  id uuid,
  requester_id uuid,
  category_id text,
  item_name text,
  details text,
  weight_grams integer,
  from_city_id integer,
  to_city_id integer,
  deadline date,
  budget_paise integer,
  photo_path text,
  status public.request_status,
  created_at timestamptz,
  exact_match boolean,
  fare_min_paise integer,
  fare_max_paise integer,
  my_offer_status public.offer_status
)
language sql
stable
set search_path = ''
as $$
  select
    r.id, r.requester_id, r.category_id, r.item_name, r.details, r.weight_grams,
    r.from_city_id, r.to_city_id, r.deadline, r.budget_paise, r.photo_path, r.status,
    r.created_at,
    (r.from_city_id = t.from_city_id and r.to_city_id = t.to_city_id) as exact_match,
    band.min_paise,
    band.max_paise,
    (
      select o.status from public.offers o
      where o.request_id = r.id and o.traveler_id = (select auth.uid())
      order by o.created_at desc
      limit 1
    )
  from public.trips t
  join public.cities tf on tf.id = t.from_city_id
  join public.cities tt on tt.id = t.to_city_id
  join public.item_requests r on r.status in ('open', 'offered')
  join public.cities rf on rf.id = r.from_city_id and rf.state_code = tf.state_code
  join public.cities rt on rt.id = r.to_city_id and rt.state_code = tt.state_code
  cross join lateral public.fare_band(r.weight_grams) band
  where t.id = p_trip_id
    and t.traveler_id = (select auth.uid())
    and r.deadline >= t.travel_date
    and r.requester_id <> (select auth.uid())
  order by exact_match desc, r.deadline, r.created_at;
$$;

revoke execute on function public.request_feed(uuid) from public, anon;
grant execute on function public.request_feed(uuid) to authenticated;
