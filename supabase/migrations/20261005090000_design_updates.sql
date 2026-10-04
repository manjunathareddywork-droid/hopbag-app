-- App redesign (docs: Hopbag App Screens.pdf). Changes decided 2026-10-05:
--   * The requester pays the Hopbag fee (on top of item + fare); the traveler
--     receives item price + full fare.
--   * Lowest fare per kg is Rs 50 (was Rs 100).
--   * A traveler can decline an item at pickup; the requester is refunded in full.
--   * Requesters see upcoming verified trips to their area (no PNR, no ticket).
--   * Onboarding intent, rating tags, dispute categories and photos, chat photos,
--     support messages, account deletion requests, notification preferences,
--     route alerts, and phone sharing after payment.

-------------------------------------------------------------------------------
-- Fees: charged to the requester, stored per payment
-------------------------------------------------------------------------------
update public.app_settings set int_value = 5000, description = 'Lowest fare per kg, in paise (Rs 50)'
where key = 'fare_min_per_kg_paise';
update public.app_settings
set description = 'Hopbag fee on the carrying fare, charged to the requester, in basis points (1000 = 10%)'
where key = 'platform_fee_bps';

create function public.platform_fee(p_fare_paise integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select ((p_fare_paise::bigint * public.setting('platform_fee_bps') + 5000) / 10000)::integer;
$$;

revoke execute on function public.platform_fee(integer) from public, anon;
grant execute on function public.platform_fee(integer) to authenticated;

alter table public.payments add column fee_paise integer not null default 0 check (fee_paise >= 0);
alter table public.payments drop constraint payments_check;
alter table public.payments
  add constraint payments_amount_check check (amount_paise = item_price_paise + fare_paise + fee_paise);

drop function public.payment_quote(uuid, uuid);

create function public.payment_quote(p_request_id uuid, p_user_id uuid)
returns table (
  request_id uuid,
  offer_id uuid,
  traveler_id uuid,
  item_name text,
  item_price_paise integer,
  fare_paise integer,
  fee_paise integer,
  amount_paise integer,
  existing_order_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  o public.offers;
  fee integer;
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found or r.requester_id is distinct from p_user_id then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'accepted' or r.accepted_offer_id is null or r.item_price_paise is null then
    raise exception 'Request is not ready for payment' using errcode = 'HB022';
  end if;
  select * into o from public.offers where id = r.accepted_offer_id;
  fee := public.platform_fee(o.fare_paise);

  return query
  select r.id, o.id, o.traveler_id, r.item_name, r.item_price_paise, o.fare_paise, fee,
         r.item_price_paise + o.fare_paise + fee,
         (select p.razorpay_order_id from public.payments p
          where p.request_id = r.id and p.status = 'created'
            and p.amount_paise = r.item_price_paise + o.fare_paise + fee
          limit 1);
end;
$$;

create or replace function public.record_order_created(
  p_request_id uuid,
  p_user_id uuid,
  p_razorpay_order_id text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  q record;
  p public.payments;
begin
  select * into q from public.payment_quote(p_request_id, p_user_id);
  update public.payments set status = 'failed'
  where request_id = p_request_id and status = 'created';

  insert into public.payments
    (request_id, offer_id, requester_id, traveler_id, item_price_paise, fare_paise, fee_paise,
     amount_paise, razorpay_order_id)
  values
    (q.request_id, q.offer_id, p_user_id, q.traveler_id, q.item_price_paise, q.fare_paise,
     q.fee_paise, q.amount_paise, p_razorpay_order_id)
  returning * into p;
  return p;
end;
$$;

revoke execute on function public.payment_quote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.payment_quote(uuid, uuid) to service_role;

-- Release: the traveler gets item + fare; the fee the requester paid goes to Hopbag.
create or replace function public.settle_request(p_request_id uuid, p_by text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
begin
  select * into p from public.payments
  where request_id = p_request_id and status = 'captured'
  for update;
  if not found then
    raise exception 'No held payment for this request' using errcode = 'HB022';
  end if;

  insert into public.payouts (payment_id, request_id, traveler_id, gross_paise, fee_paise, net_paise)
  values (p.id, p.request_id, p.traveler_id, p.amount_paise, p.fee_paise, p.amount_paise - p.fee_paise)
  on conflict (payment_id) do nothing;

  insert into public.ledger_entries (txn_key, payment_id, account, amount_paise)
  select 'release:' || p.id, p.id, leg.account, leg.amount
  from (values
    ('held', -p.amount_paise),
    ('traveler', p.amount_paise - p.fee_paise),
    ('platform_fee', p.fee_paise)
  ) as leg (account, amount)
  where leg.amount <> 0
  on conflict (txn_key, account) do nothing;

  update public.deliveries
  set settled_at = coalesce(settled_at, now()), settled_by = coalesce(settled_by, p_by)
  where request_id = p_request_id;

  update public.item_requests set status = 'settled'
  where id = p_request_id and status in ('delivered', 'disputed');
end;
$$;

-- The requester can confirm they have the item even before a handover is marked.
create or replace function public.confirm_received(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
begin
  select * into r from public.item_requests where id = p_request_id for update;
  if not found or r.requester_id is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status not in ('picked_up', 'delivered') then
    raise exception 'Nothing to confirm' using errcode = 'HB010';
  end if;
  if r.status = 'picked_up' then
    update public.deliveries
    set delivered_at = coalesce(delivered_at, now()), delivery_method = coalesce(delivery_method, 'code')
    where request_id = p_request_id;
    update public.item_requests set status = 'delivered' where id = p_request_id;
  end if;
  delete from public.handover_codes where request_id = p_request_id;
  perform public.settle_request(p_request_id, 'requester');
end;
$$;

-------------------------------------------------------------------------------
-- Declining at pickup (refund goes through the decline-pickup Edge Function)
-------------------------------------------------------------------------------
create table public.pickup_declines (
  request_id uuid primary key references public.item_requests (id) on delete cascade,
  traveler_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason = btrim(reason) and char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

alter table public.pickup_declines enable row level security;
revoke all on public.pickup_declines from anon, authenticated;
grant select on public.pickup_declines to authenticated;
grant select, insert on public.pickup_declines to service_role;

create policy "Both people and admins see why an item was declined"
  on public.pickup_declines for select
  to authenticated
  using (
    traveler_id = (select auth.uid())
    or public.owns_request(request_id)
    or (select public.is_admin())
  );

/** Service role: may this traveler decline this item now? Returns the held payment. */
create function public.decline_pickup_quote(p_request_id uuid, p_user_id uuid)
returns public.payments
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  p public.payments;
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found or public.request_traveler(p_request_id) is distinct from p_user_id then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'paid' then
    raise exception 'Only an item waiting for pickup can be declined' using errcode = 'HB010';
  end if;
  select * into p from public.payments where request_id = p_request_id and status = 'captured';
  if not found then
    raise exception 'No held payment' using errcode = 'HB024';
  end if;
  return p;
end;
$$;

create function public.record_pickup_declined(p_request_id uuid, p_user_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.pickup_declines (request_id, traveler_id, reason)
  values (p_request_id, p_user_id, btrim(p_reason))
  on conflict (request_id) do nothing;
$$;

revoke execute on function public.decline_pickup_quote(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_pickup_declined(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.decline_pickup_quote(uuid, uuid) to service_role;
grant execute on function public.record_pickup_declined(uuid, uuid, text) to service_role;

-------------------------------------------------------------------------------
-- Upcoming trips that requesters can see (travelers who post a trip agree to it)
-------------------------------------------------------------------------------
/** "Sneha I." */
create function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when position(' ' in btrim(full_name)) = 0 then btrim(full_name)
    else split_part(btrim(full_name), ' ', 1) || ' '
         || upper(left(split_part(btrim(full_name), ' ', array_length(string_to_array(btrim(full_name), ' '), 1)), 1)) || '.'
  end
  from public.profiles where id = p_user_id;
$$;

revoke execute on function public.display_name(uuid) from public, anon;
grant execute on function public.display_name(uuid) to authenticated;

/**
 * Verified, ticket-approved upcoming trips into a state (the caller's home state
 * by default). Only safe fields: never the PNR or the ticket. Blocked people and
 * suspended travelers are left out.
 */
create function public.upcoming_trips(p_to_state text default null)
returns table (
  trip_id uuid,
  traveler_id uuid,
  traveler_name text,
  from_city_id integer,
  to_city_id integer,
  travel_date date,
  mode public.travel_mode,
  free_grams integer,
  free_items integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.traveler_id, public.display_name(t.traveler_id), t.from_city_id, t.to_city_id,
         t.travel_date, t.mode,
         greatest(t.capacity_grams - load.grams, 0), greatest(t.max_items - load.items, 0)
  from public.trips t
  join public.cities tc on tc.id = t.to_city_id
  cross join lateral public.trip_load(t.id) load
  where t.status = 'active'
    and t.ticket_status = 'approved'
    and t.travel_date >= public.today_ist()
    and tc.state_code = coalesce(
      p_to_state,
      (select home_state from public.profiles where id = (select auth.uid()))
    )
    and public.is_verified_traveler(t.traveler_id)
    and t.traveler_id <> (select auth.uid())
    and not exists (select 1 from public.account_suspensions s where s.user_id = t.traveler_id)
    and not public.is_blocked_between((select auth.uid()), t.traveler_id)
    and load.items < t.max_items
  order by t.travel_date, t.id
  limit 20;
$$;

revoke execute on function public.upcoming_trips(text) from public, anon;
grant execute on function public.upcoming_trips(text) to authenticated;

/** Public stats for a person's profile card (rating, deliveries, disputes, joined). */
create function public.profile_stats(p_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  full_name text,
  home_city_id integer,
  joined_at timestamptz,
  verified boolean,
  rating numeric,
  ratings integer,
  deliveries integer,
  requests integer,
  disputes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, public.display_name(p.id), p.full_name, p.home_city_id, p.created_at,
         p.traveler_verified_at is not null,
         (select round(avg(stars), 1) from public.ratings where ratee_id = p.id),
         (select count(*)::integer from public.ratings where ratee_id = p.id),
         (select count(*)::integer from public.payouts where traveler_id = p.id),
         (select count(*)::integer from public.item_requests where requester_id = p.id),
         (select count(*)::integer from public.disputes d
          join public.offers o on o.request_id = d.request_id and o.status = 'accepted'
          where o.traveler_id = p.id)
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Profiles: onboarding intent and notification preferences
-------------------------------------------------------------------------------
alter table public.profiles
  add column intent text not null default 'get' check (intent in ('get', 'carry', 'both')),
  add column push_enabled boolean not null default true,
  add column offer_alerts boolean not null default true;

grant insert (intent), update (intent, push_enabled, offer_alerts) on public.profiles to authenticated;

-- Pushes respect the switch (Updates in the app still show everything).
create or replace function public.claim_push_batch(p_limit integer default 100)
returns table (
  id bigint,
  user_id uuid,
  kind text,
  request_id uuid,
  trip_id uuid,
  params jsonb,
  tokens text[]
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notifications n
    set push_claimed_at = now()
    where n.id in (
      select q.id from public.notifications q
      where q.push_claimed_at is null and q.created_at > now() - interval '1 day'
      order by q.id
      limit p_limit
      for update skip locked
    )
    returning n.*
  )
  select c.id, c.user_id, c.kind, c.request_id, c.trip_id, c.params,
         coalesce(array_agg(t.token) filter (where t.token is not null and pr.push_enabled), '{}')
  from claimed c
  join public.profiles pr on pr.id = c.user_id
  left join public.push_tokens t on t.user_id = c.user_id
  group by c.id, c.user_id, c.kind, c.request_id, c.trip_id, c.params
  order by c.id;
$$;

-------------------------------------------------------------------------------
-- Route alerts: tell travelers with a matching upcoming trip about new requests
-------------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'offer_received', 'offer_accepted', 'offer_not_chosen', 'request_paid', 'picked_up',
  'handed_over', 'completed', 'payout_unlocked', 'disputed', 'dispute_resolved', 'refunded',
  'expired', 'message', 'rated', 'id_approved', 'id_rejected', 'ticket_approved',
  'ticket_rejected', 'route_request', 'pickup_declined'
));

create function public.notify_route_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip record;
begin
  for trip in
    select distinct on (t.traveler_id) t.traveler_id, t.id
    from public.trips t
    join public.cities tf on tf.id = t.from_city_id
    join public.cities tt on tt.id = t.to_city_id
    join public.profiles pr on pr.id = t.traveler_id
    where t.status = 'active' and t.ticket_status = 'approved'
      and t.travel_date between public.today_ist() and new.deadline
      and tf.state_code = (select state_code from public.cities where id = new.from_city_id)
      and tt.state_code = (select state_code from public.cities where id = new.to_city_id)
      and t.traveler_id <> new.requester_id
      and pr.offer_alerts
      and pr.traveler_verified_at is not null
      and not public.is_blocked_between(t.traveler_id, new.requester_id)
    order by t.traveler_id, t.travel_date
  loop
    perform public.notify(trip.traveler_id, 'route_request', new.id, trip.id,
                          jsonb_build_object('item', new.item_name));
  end loop;
  return new;
end;
$$;

create trigger item_requests_notify_route
  after insert on public.item_requests
  for each row execute function public.notify_route_request();

-- Pickup declined: tell the requester.
create function public.notify_pickup_declined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(
    (select requester_id from public.item_requests where id = new.request_id),
    'pickup_declined', new.request_id, null,
    jsonb_build_object(
      'item', (select item_name from public.item_requests where id = new.request_id),
      'name', public.first_name(new.traveler_id),
      'reason', new.reason));
  return new;
end;
$$;

create trigger pickup_declines_notify
  after insert on public.pickup_declines
  for each row execute function public.notify_pickup_declined();

-------------------------------------------------------------------------------
-- Ratings: quick tags
-------------------------------------------------------------------------------
alter table public.ratings
  add column tags text[] not null default '{}'
    check (tags <@ array['on_time', 'great_shape', 'easy_to_talk', 'clear_details', 'friendly']);

drop function public.rate_counterpart(uuid, integer, text);

create function public.rate_counterpart(
  p_request_id uuid,
  p_stars integer,
  p_comment text default '',
  p_tags text[] default '{}'
)
returns public.ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  traveler uuid;
  ratee uuid;
  rating public.ratings;
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  traveler := public.request_traveler(p_request_id);
  if (select auth.uid()) is distinct from r.requester_id
    and (select auth.uid()) is distinct from traveler
  then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'settled' then
    raise exception 'You can rate after the delivery is completed' using errcode = 'HB010';
  end if;

  ratee := case when (select auth.uid()) = r.requester_id then traveler else r.requester_id end;
  insert into public.ratings (request_id, rater_id, ratee_id, stars, comment, tags)
  values (p_request_id, (select auth.uid()), ratee, p_stars, btrim(coalesce(p_comment, '')),
          coalesce(p_tags, '{}'))
  returning * into rating;

  perform public.notify(ratee, 'rated', p_request_id, null,
                        jsonb_build_object('item', r.item_name, 'stars', p_stars));
  return rating;
end;
$$;

revoke execute on function public.rate_counterpart(uuid, integer, text, text[]) from public, anon;
grant execute on function public.rate_counterpart(uuid, integer, text, text[]) to authenticated;

-------------------------------------------------------------------------------
-- Disputes: a category and optional photos
-------------------------------------------------------------------------------
alter table public.disputes
  add column category text not null default 'other'
    check (category in ('damaged', 'not_as_described', 'not_responding', 'other')),
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5);
alter table public.disputes drop constraint disputes_reason_check;
alter table public.disputes
  add constraint disputes_reason_check check (reason = btrim(reason) and char_length(reason) <= 1000);

drop function public.raise_dispute(uuid, text);

create function public.raise_dispute(
  p_request_id uuid,
  p_reason text,
  p_category text default 'other',
  p_photo_paths text[] default '{}'
)
returns public.disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  dispute public.disputes;
  me text := (select auth.uid())::text;
begin
  select * into r from public.item_requests where id = p_request_id for update;
  if not found
    or ((select auth.uid()) is distinct from r.requester_id
        and (select auth.uid()) is distinct from public.request_traveler(p_request_id))
  then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status not in ('paid', 'picked_up', 'delivered') then
    raise exception 'A problem can no longer be reported for this request' using errcode = 'HB010';
  end if;
  -- "Something else" needs a description; the other choices speak for themselves.
  if coalesce(p_category, 'other') = 'other' and char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Describe the problem in a few words' using errcode = 'HB027';
  end if;
  if exists (select 1 from unnest(coalesce(p_photo_paths, '{}')) path where path not like me || '/%') then
    raise exception 'Photos must be your own uploads' using errcode = 'HB010';
  end if;

  insert into public.disputes (request_id, raised_by, reason, category, photo_paths)
  values (p_request_id, (select auth.uid()), btrim(coalesce(p_reason, '')),
          coalesce(p_category, 'other'), coalesce(p_photo_paths, '{}'))
  returning * into dispute;
  update public.item_requests set status = 'disputed' where id = p_request_id;
  return dispute;
end;
$$;

revoke execute on function public.raise_dispute(uuid, text, text, text[]) from public, anon;
grant execute on function public.raise_dispute(uuid, text, text, text[]) to authenticated;

-------------------------------------------------------------------------------
-- Chat: photo messages
-------------------------------------------------------------------------------
alter table public.messages add column photo_path text;
alter table public.messages drop constraint messages_body_check;
alter table public.messages
  add constraint messages_body_check check (body = btrim(body) and char_length(body) <= 1000),
  add constraint messages_has_content check (body <> '' or photo_path is not null),
  add constraint messages_photo_own_folder
    check (photo_path is null or photo_path like sender_id::text || '/%');
grant insert (photo_path) on public.messages to authenticated;

-- Photo-only messages still notify, with a short preview.
create or replace function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  recipient uuid;
begin
  select * into r from public.item_requests where id = new.request_id;
  recipient := case when new.sender_id = r.requester_id
                    then public.request_traveler(r.id) else r.requester_id end;
  perform public.notify(recipient, 'message', r.id, null, jsonb_build_object(
    'item', r.item_name,
    'name', public.first_name(new.sender_id),
    'preview', case when new.body = '' then '📷' else left(new.body, 80) end));
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- New private buckets: chat photos and dispute photos
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-photos', 'chat-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('dispute-photos', 'dispute-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "People upload their own chat and dispute photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('chat-photos', 'dispute-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "The two people in a chat see its photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.messages m where m.photo_path = storage.objects.name)
      or (select public.is_admin())
    )
  );

create policy "The people in a dispute and admins see its photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'dispute-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.disputes d where storage.objects.name = any (d.photo_paths))
      or (select public.is_admin())
    )
  );

-------------------------------------------------------------------------------
-- Phone numbers after payment (same rule as chat)
-------------------------------------------------------------------------------
create function public.counterpart_phone(p_request_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  other uuid;
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found or not public.is_chat_participant(p_request_id)
    or not public.phone_sharing_allowed(r.status) or r.status = 'settled'
  then
    return null;
  end if;
  other := case when (select auth.uid()) = r.requester_id
                then public.request_traveler(r.id) else r.requester_id end;
  return (select '+' || phone from auth.users where id = other);
end;
$$;

revoke execute on function public.counterpart_phone(uuid) from public, anon;
grant execute on function public.counterpart_phone(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Support messages and account deletion requests (handled by admins)
-------------------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (body = btrim(body) and char_length(body) between 5 and 2000),
  status text not null default 'open' check (status in ('open', 'answered')),
  created_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'done', 'refused')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;
alter table public.account_deletion_requests enable row level security;

revoke all on public.support_messages, public.account_deletion_requests from anon, authenticated;
grant select on public.support_messages, public.account_deletion_requests to authenticated;
grant insert (body) on public.support_messages to authenticated;
grant insert (user_id) on public.account_deletion_requests to authenticated;

create policy "People see their own support messages, admins see all"
  on public.support_messages for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "People write to support"
  on public.support_messages for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');

create policy "People see their own deletion request, admins see all"
  on public.account_deletion_requests for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "People ask to delete their own account"
  on public.account_deletion_requests for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create function public.support_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('support:' || new.user_id, 10, 86400);
  return new;
end;
$$;

create trigger support_messages_rate_limit
  before insert on public.support_messages
  for each row execute function public.support_rate_limit();

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'verified_travelers', (select count(*) from public.profiles where traveler_verified_at is not null),
    'suspended_users', (select count(*) from public.account_suspensions),
    'open_requests', (select count(*) from public.item_requests where status in ('open', 'offered')),
    'in_progress', (select count(*) from public.item_requests
                    where status in ('accepted', 'paid', 'picked_up', 'delivered')),
    'completed', (select count(*) from public.item_requests where status = 'settled'),
    'upcoming_trips', (select count(*) from public.trips
                       where status = 'active' and travel_date >= public.today_ist()),
    'pending_ids', (select count(*) from public.traveler_verifications where status = 'pending'),
    'pending_tickets', (select count(*) from public.trips
                        where status = 'active' and ticket_status = 'pending'),
    'open_disputes', (select count(*) from public.disputes where status = 'open'),
    'open_reports', (select count(*) from public.user_reports where status = 'open'),
    'open_support', (select count(*) from public.support_messages where status = 'open'),
    'deletion_requests', (select count(*) from public.account_deletion_requests where status = 'pending'),
    'held_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'held'),
    'released_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'traveler'),
    'fees_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'platform_fee'),
    'errors_24h', (select count(*) from public.app_errors where created_at > now() - interval '24 hours')
  );
end;
$$;

-------------------------------------------------------------------------------
-- Chat photos (bills, item photos) are deleted 7 days after the request is
-- finished (decided 2026-10-05). Never while a dispute is open.
-------------------------------------------------------------------------------
alter table public.messages add column photo_deleted_at timestamptz;

/** Service role: chat photos that are due for deletion. */
create function public.chat_photos_due(p_limit integer default 200)
returns table (message_id bigint, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.photo_path
  from public.messages m
  join public.item_requests r on r.id = m.request_id
  where m.photo_path is not null
    and m.photo_deleted_at is null
    and r.status in ('settled', 'refunded', 'cancelled', 'expired')
    and r.updated_at < now() - interval '7 days'
    and not exists (select 1 from public.disputes d where d.request_id = r.id and d.status = 'open')
  order by m.id
  limit p_limit;
$$;

create function public.mark_chat_photos_deleted(p_message_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set photo_deleted_at = now() where id = any (p_message_ids);
$$;

revoke execute on function public.chat_photos_due(integer) from public, anon, authenticated;
revoke execute on function public.mark_chat_photos_deleted(bigint[]) from public, anon, authenticated;
grant execute on function public.chat_photos_due(integer) to service_role;
grant execute on function public.mark_chat_photos_deleted(bigint[]) to service_role;

-- Daily at 04:10 IST (22:40 UTC). Same Vault secrets as the push sender.
select cron.schedule(
  'purge-chat-photos',
  '40 22 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/purge-chat-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'notifications_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'notifications_cron_secret')
    and exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $$
);
