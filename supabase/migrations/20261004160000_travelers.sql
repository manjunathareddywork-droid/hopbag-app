-- Phase 3: traveler identity verification, trips with ticket review, admin review
-- functions, and the "can this trip carry requests?" rule used from Phase 4 on.
--
-- New error codes (see 20261004140000_item_requests.sql for HB001-HB011):
--   HB006 travel date out of range      HB007 over the trip limits
--   HB012 admins only                   HB013 verification already pending/approved
--   HB014 reason required to reject

-------------------------------------------------------------------------------
-- Settings that admins can change without a release (PRODUCT.md rule 5).
-------------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  int_value integer not null,
  description text not null default ''
);

alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
grant update (int_value) on public.app_settings to authenticated;

create policy "Signed-in users can read settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "Admins can change settings"
  on public.app_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.app_settings (key, int_value, description) values
  ('trip_max_items', 3, 'Most requests one traveler can carry on one trip'),
  ('trip_max_grams', 5000, 'Most total weight one traveler can carry on one trip, in grams'),
  ('trip_max_days_ahead', 60, 'How far ahead a trip can be added, in days');

create function public.setting(setting_key text)
returns integer
language sql
stable
set search_path = ''
as $$
  select int_value from public.app_settings where key = setting_key;
$$;

-------------------------------------------------------------------------------
-- Verified badge on the public profile. Set only by review_verification().
-------------------------------------------------------------------------------
alter table public.profiles add column traveler_verified_at timestamptz;
-- No grant: clients cannot write it (profile grants are per column).

-------------------------------------------------------------------------------
-- Identity verification (one ID photo per person, reviewed by an admin).
-------------------------------------------------------------------------------
create type public.id_document_type as enum (
  'aadhaar', 'pan', 'driving_licence', 'passport', 'voter_id'
);

create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.traveler_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  id_type public.id_document_type not null,
  id_photo_path text not null check (id_photo_path like user_id::text || '/%'),
  status public.review_status not null default 'pending',
  reject_reason text check (reject_reason is null or char_length(reject_reason) between 3 and 300),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one submission waiting for review per person.
create unique index traveler_verifications_one_pending
  on public.traveler_verifications (user_id) where status = 'pending';
create index traveler_verifications_status_idx
  on public.traveler_verifications (status, created_at);

create function public.traveler_verifications_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.traveler_verifications
    where user_id = new.user_id and status in ('pending', 'approved')
  ) then
    raise exception 'Verification already pending or approved' using errcode = 'HB013';
  end if;
  return new;
end;
$$;

create trigger traveler_verifications_before_insert
  before insert on public.traveler_verifications
  for each row execute function public.traveler_verifications_before_insert();

alter table public.traveler_verifications enable row level security;

revoke all on public.traveler_verifications from anon, authenticated;
grant select on public.traveler_verifications to authenticated;
grant insert (id_type, id_photo_path) on public.traveler_verifications to authenticated;

create policy "Users see their own verifications, admins see all"
  on public.traveler_verifications for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users submit their own verification"
  on public.traveler_verifications for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-------------------------------------------------------------------------------
-- Trips. The ticket (photo + PNR) is reviewed per trip.
-------------------------------------------------------------------------------
create type public.travel_mode as enum ('train', 'bus', 'flight', 'car', 'other');
create type public.trip_status as enum ('active', 'cancelled', 'completed');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  from_city_id integer not null references public.cities (id),
  to_city_id integer not null references public.cities (id),
  travel_date date not null,
  mode public.travel_mode not null,
  capacity_grams integer not null check (capacity_grams between 100 and 50000),
  max_items integer not null check (max_items between 1 and 20),
  pnr text not null check (pnr ~ '^[A-Z0-9]{5,12}$'),
  ticket_photo_path text not null check (ticket_photo_path like traveler_id::text || '/%'),
  ticket_status public.review_status not null default 'pending',
  ticket_reject_reason text
    check (ticket_reject_reason is null or char_length(ticket_reject_reason) between 3 and 300),
  ticket_reviewed_by uuid references auth.users (id),
  ticket_reviewed_at timestamptz,
  status public.trip_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_city_id <> to_city_id)
);

create index trips_traveler_idx on public.trips (traveler_id, travel_date desc);
create index trips_ticket_review_idx on public.trips (ticket_status, created_at)
  where status = 'active';
create index trips_route_idx on public.trips (from_city_id, to_city_id, travel_date)
  where status = 'active' and ticket_status = 'approved';

create function public.trips_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  from_state text;
  to_state text;
begin
  -- A new ticket (photo or PNR) goes back for review.
  if tg_op = 'UPDATE'
    and (new.ticket_photo_path is distinct from old.ticket_photo_path
         or new.pnr is distinct from old.pnr)
  then
    new.ticket_status := 'pending';
    new.ticket_reject_reason := null;
    new.ticket_reviewed_by := null;
    new.ticket_reviewed_at := null;
  end if;

  if tg_op = 'UPDATE'
    and new.from_city_id is not distinct from old.from_city_id
    and new.to_city_id is not distinct from old.to_city_id
    and new.travel_date is not distinct from old.travel_date
    and new.capacity_grams is not distinct from old.capacity_grams
    and new.max_items is not distinct from old.max_items
  then
    return new;
  end if;

  select state_code into from_state from public.cities where id = new.from_city_id;
  select state_code into to_state from public.cities where id = new.to_city_id;
  if from_state = to_state then
    raise exception 'From and to cities must be in different states' using errcode = 'HB004';
  end if;

  if new.travel_date < public.today_ist()
    or new.travel_date > public.today_ist() + public.setting('trip_max_days_ahead')
  then
    raise exception 'Travel date must be between today and % days ahead',
      public.setting('trip_max_days_ahead')
      using errcode = 'HB006', detail = public.setting('trip_max_days_ahead')::text;
  end if;

  if new.capacity_grams > public.setting('trip_max_grams')
    or new.max_items > public.setting('trip_max_items')
  then
    raise exception 'Trip is over the limit of % items and % g',
      public.setting('trip_max_items'), public.setting('trip_max_grams')
      using errcode = 'HB007',
        detail = public.setting('trip_max_items') || ',' || public.setting('trip_max_grams');
  end if;

  return new;
end;
$$;

create trigger trips_validate
  before insert or update on public.trips
  for each row execute function public.trips_validate();

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;

revoke all on public.trips from anon, authenticated;
grant select on public.trips to authenticated;
grant insert (
  from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr, ticket_photo_path
) on public.trips to authenticated;
-- Re-upload a ticket after rejection, or fix the trip details while not yet approved.
grant update (
  from_city_id, to_city_id, travel_date, mode, capacity_grams, max_items, pnr, ticket_photo_path
) on public.trips to authenticated;

-- Phase 4 adds a policy letting requesters see matching approved trips.
create policy "Travelers see their own trips, admins see all"
  on public.trips for select
  to authenticated
  using (traveler_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users add their own trips"
  on public.trips for insert
  to authenticated
  with check (
    traveler_id = (select auth.uid()) and status = 'active' and ticket_status = 'pending'
  );

create policy "Travelers edit active trips until the ticket is approved"
  on public.trips for update
  to authenticated
  using (
    traveler_id = (select auth.uid()) and status = 'active' and ticket_status <> 'approved'
  )
  with check (traveler_id = (select auth.uid()) and status = 'active');

-------------------------------------------------------------------------------
-- Who can carry: verified traveler + approved ticket + active, upcoming trip.
-- Phase 4's offers must check this; it is the database-level block on
-- unverified users accepting requests.
-------------------------------------------------------------------------------
create function public.is_verified_traveler(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = user_id and p.traveler_verified_at is not null
  );
$$;

create function public.trip_can_carry(trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and t.status = 'active'
      and t.ticket_status = 'approved'
      and t.travel_date >= public.today_ist()
      and public.is_verified_traveler(t.traveler_id)
  );
$$;

revoke execute on function public.is_verified_traveler(uuid) from public, anon;
revoke execute on function public.trip_can_carry(uuid) from public, anon;
grant execute on function public.is_verified_traveler(uuid) to authenticated;
grant execute on function public.trip_can_carry(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Traveler actions
-------------------------------------------------------------------------------
create function public.cancel_trip(trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip public.trips;
begin
  select * into trip from public.trips where id = trip_id for update;
  if not found or trip.traveler_id is distinct from (select auth.uid()) then
    raise exception 'Trip not found' using errcode = 'HB011';
  end if;
  if trip.status <> 'active' then
    raise exception 'Trip is not active' using errcode = 'HB010';
  end if;
  update public.trips set status = 'cancelled' where id = trip_id returning * into trip;
  return trip;
end;
$$;

revoke execute on function public.cancel_trip(uuid) from public, anon;
grant execute on function public.cancel_trip(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Admin review
-------------------------------------------------------------------------------
create function public.review_verification(
  verification_id uuid,
  approve boolean,
  reason text default null
)
returns public.traveler_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.traveler_verifications;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;

  select * into v from public.traveler_verifications where id = verification_id for update;
  if not found then
    raise exception 'Verification not found' using errcode = 'HB011';
  end if;
  if v.status <> 'pending' then
    raise exception 'Verification was already reviewed' using errcode = 'HB010';
  end if;
  if not approve and char_length(btrim(coalesce(reason, ''))) < 3 then
    raise exception 'A reason is required to reject' using errcode = 'HB014';
  end if;

  update public.traveler_verifications
  set status = case when approve then 'approved'::public.review_status else 'rejected' end,
      reject_reason = case when approve then null else btrim(reason) end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = verification_id
  returning * into v;

  if approve then
    update public.profiles set traveler_verified_at = now() where id = v.user_id;
  end if;

  return v;
end;
$$;

create function public.review_trip_ticket(
  trip_id uuid,
  approve boolean,
  reason text default null
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip public.trips;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;

  select * into trip from public.trips where id = trip_id for update;
  if not found then
    raise exception 'Trip not found' using errcode = 'HB011';
  end if;
  if trip.ticket_status <> 'pending' or trip.status <> 'active' then
    raise exception 'Ticket was already reviewed' using errcode = 'HB010';
  end if;
  if not approve and char_length(btrim(coalesce(reason, ''))) < 3 then
    raise exception 'A reason is required to reject' using errcode = 'HB014';
  end if;

  update public.trips
  set ticket_status = case when approve then 'approved'::public.review_status else 'rejected' end,
      ticket_reject_reason = case when approve then null else btrim(reason) end,
      ticket_reviewed_by = auth.uid(),
      ticket_reviewed_at = now()
  where id = trip_id
  returning * into trip;

  return trip;
end;
$$;

revoke execute on function public.review_verification(uuid, boolean, text) from public, anon;
revoke execute on function public.review_trip_ticket(uuid, boolean, text) from public, anon;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.review_trip_ticket(uuid, boolean, text) to authenticated;

-------------------------------------------------------------------------------
-- Traveler documents (ID photos, tickets): private. Owners upload into their
-- own folder and can view their own files; they cannot change or delete them
-- (they are review evidence). Admins can view all.
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('traveler-docs', 'traveler-docs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Owners and admins can view traveler documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'traveler-docs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

create policy "Users can upload their own traveler documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'traveler-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
