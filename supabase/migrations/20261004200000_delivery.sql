-- Phase 6: pickup, handover codes, delivery, settlement (payout released in the
-- ledger, test mode), 48-hour auto-confirm and disputes that freeze payout.
--
-- Flow: paid -> picked_up (traveler, photo + weight)
--       picked_up -> delivered -> settled   (traveler enters the requester's code)
--       picked_up -> delivered (handed over, 48 h to confirm) -> settled
--       paid / picked_up / delivered -> disputed -> settled (release) or refunded
--
-- New error codes:
--   HB025 no handover code issued yet       HB026 code locked after too many tries
--   HB027 dispute reason too short

create extension if not exists pgcrypto with schema extensions;

insert into public.app_settings (key, int_value, description) values
  ('handover_code_max_attempts', 5, 'Wrong handover code entries before the code locks'),
  ('auto_confirm_hours', 48, 'Hours the requester has to confirm a handover without code');

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------
create table public.deliveries (
  request_id uuid primary key references public.item_requests (id) on delete restrict,
  traveler_id uuid not null references public.profiles (id) on delete restrict,
  pickup_photo_path text not null check (pickup_photo_path like traveler_id::text || '/%'),
  pickup_weight_grams integer not null check (pickup_weight_grams between 1 and 50000),
  picked_up_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivery_method text check (delivery_method in ('code', 'handover')),
  confirm_by timestamptz,
  settled_at timestamptz,
  settled_by text check (settled_by in ('code', 'requester', 'auto', 'admin'))
);

create index deliveries_awaiting_confirm_idx
  on public.deliveries (confirm_by) where settled_at is null and delivery_method = 'handover';

-- One-time codes, stored only as a hash. No client can read this table.
create table public.handover_codes (
  request_id uuid primary key references public.item_requests (id) on delete cascade,
  code_hash text not null,
  failed_attempts integer not null default 0,
  issued_at timestamptz not null default now()
);

create type public.dispute_status as enum ('open', 'resolved');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.item_requests (id) on delete restrict,
  raised_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null check (reason = btrim(reason) and char_length(reason) between 10 and 1000),
  status public.dispute_status not null default 'open',
  resolution text check (resolution in ('released', 'refunded')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index disputes_one_open_per_request on public.disputes (request_id) where status = 'open';
create index disputes_open_idx on public.disputes (created_at) where status = 'open';

-- Released to the traveler. 'ready' = unlocked in Hopbag; 'transferred' once a
-- Razorpay Route transfer exists (after the Route decision, docs/PAYMENTS.md).
create type public.payout_status as enum ('ready', 'transferred');

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  request_id uuid not null references public.item_requests (id) on delete restrict,
  traveler_id uuid not null references public.profiles (id) on delete restrict,
  gross_paise integer not null check (gross_paise > 0),
  fee_paise integer not null check (fee_paise >= 0),
  net_paise integer not null check (net_paise = gross_paise - fee_paise and net_paise > 0),
  status public.payout_status not null default 'ready',
  created_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- Access: read-only for the two people involved (and admins). Every change goes
-- through the functions below.
-------------------------------------------------------------------------------
create function public.request_traveler(p_request_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.traveler_id
  from public.item_requests r
  join public.offers o on o.id = r.accepted_offer_id
  where r.id = p_request_id;
$$;

revoke execute on function public.request_traveler(uuid) from public, anon;
grant execute on function public.request_traveler(uuid) to authenticated;

alter table public.deliveries enable row level security;
alter table public.handover_codes enable row level security;
alter table public.disputes enable row level security;
alter table public.payouts enable row level security;

revoke all on public.deliveries, public.handover_codes, public.disputes, public.payouts
  from anon, authenticated;
grant select on public.deliveries, public.handover_codes, public.disputes, public.payouts
  to authenticated;
grant select on public.deliveries, public.disputes, public.payouts to service_role;

create policy "Requester, traveler and admins see the delivery"
  on public.deliveries for select
  to authenticated
  using (
    traveler_id = (select auth.uid())
    or public.owns_request(request_id)
    or (select public.is_admin())
  );

-- Only admins may even see the hashes (for support); the code itself is never stored.
create policy "Admins can see handover code records"
  on public.handover_codes for select
  to authenticated
  using ((select public.is_admin()));

create policy "Requester, traveler and admins see disputes"
  on public.disputes for select
  to authenticated
  using (
    public.owns_request(request_id)
    or public.request_traveler(request_id) = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Travelers and admins see payouts"
  on public.payouts for select
  to authenticated
  using (traveler_id = (select auth.uid()) or (select public.is_admin()));

-- Pickup photos: the traveler uploads to their own folder; the requester of that
-- delivery and admins can view them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handover-photos', 'handover-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Travelers upload their own pickup photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'handover-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Traveler, requester and admins see pickup photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'handover-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.deliveries d
        where d.pickup_photo_path = storage.objects.name
      )
      or (select public.is_admin())
    )
  );

-------------------------------------------------------------------------------
-- Settlement (internal): release the payment to the traveler minus the fee.
-------------------------------------------------------------------------------
create function public.settle_request(p_request_id uuid, p_by text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  fee integer;
begin
  select * into p from public.payments
  where request_id = p_request_id and status = 'captured'
  for update;
  if not found then
    raise exception 'No held payment for this request' using errcode = 'HB022';
  end if;

  -- Fee on the traveler's fare only (not the item cost), rounded to the nearest paisa.
  fee := ((p.fare_paise::bigint * public.setting('platform_fee_bps') + 5000) / 10000)::integer;

  insert into public.payouts (payment_id, request_id, traveler_id, gross_paise, fee_paise, net_paise)
  values (p.id, p.request_id, p.traveler_id, p.amount_paise, fee, p.amount_paise - fee)
  on conflict (payment_id) do nothing;

  insert into public.ledger_entries (txn_key, payment_id, account, amount_paise)
  select 'release:' || p.id, p.id, leg.account, leg.amount
  from (values
    ('held', -p.amount_paise),
    ('traveler', p.amount_paise - fee),
    ('platform_fee', fee)
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

-------------------------------------------------------------------------------
-- Traveler: pickup and delivery
-------------------------------------------------------------------------------
create function public.mark_picked_up(
  p_request_id uuid,
  p_photo_path text,
  p_weight_grams integer
)
returns public.deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  d public.deliveries;
begin
  select * into r from public.item_requests where id = p_request_id for update;
  if not found or public.request_traveler(p_request_id) is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'paid' then
    raise exception 'Request is not waiting for pickup' using errcode = 'HB010';
  end if;

  insert into public.deliveries (request_id, traveler_id, pickup_photo_path, pickup_weight_grams)
  values (p_request_id, (select auth.uid()), p_photo_path, p_weight_grams)
  returning * into d;

  update public.item_requests set status = 'picked_up' where id = p_request_id;
  return d;
end;
$$;

/**
 * Traveler enters the requester's code. Returns 'settled', 'wrong_code' or
 * 'locked' (returns instead of raising so failed attempts are counted).
 */
create function public.confirm_delivery_code(p_request_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  c public.handover_codes;
  max_attempts integer := public.setting('handover_code_max_attempts');
begin
  select * into r from public.item_requests where id = p_request_id for update;
  if not found or public.request_traveler(p_request_id) is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status not in ('picked_up', 'delivered') then
    raise exception 'Request is not waiting for delivery' using errcode = 'HB010';
  end if;

  select * into c from public.handover_codes where request_id = p_request_id for update;
  if not found then
    raise exception 'No handover code issued yet' using errcode = 'HB025';
  end if;
  if c.failed_attempts >= max_attempts then
    return 'locked';
  end if;

  if c.code_hash <> encode(extensions.digest(p_request_id::text || ':' || coalesce(p_code, ''), 'sha256'), 'hex') then
    update public.handover_codes set failed_attempts = failed_attempts + 1
    where request_id = p_request_id;
    return case when c.failed_attempts + 1 >= max_attempts then 'locked' else 'wrong_code' end;
  end if;

  delete from public.handover_codes where request_id = p_request_id; -- one-time
  update public.deliveries
  set delivered_at = coalesce(delivered_at, now()), delivery_method = 'code', confirm_by = null
  where request_id = p_request_id;
  if r.status = 'picked_up' then
    update public.item_requests set status = 'delivered' where id = p_request_id;
  end if;
  perform public.settle_request(p_request_id, 'code');
  return 'settled';
end;
$$;

/** Handed over without the code: the requester has N hours to confirm or dispute. */
create function public.mark_handed_over(p_request_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  d public.deliveries;
begin
  select * into r from public.item_requests where id = p_request_id for update;
  if not found or public.request_traveler(p_request_id) is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'picked_up' then
    raise exception 'Request is not waiting for delivery' using errcode = 'HB010';
  end if;

  update public.deliveries
  set delivered_at = now(),
      delivery_method = 'handover',
      confirm_by = now() + make_interval(hours => public.setting('auto_confirm_hours'))
  where request_id = p_request_id
  returning * into d;
  update public.item_requests set status = 'delivered' where id = p_request_id;
  return d;
end;
$$;

-------------------------------------------------------------------------------
-- Requester: handover code and confirming receipt
-------------------------------------------------------------------------------

/** Issues a fresh one-time 6-digit code (any earlier code stops working). */
create function public.issue_handover_code(p_request_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  code text;
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found or r.requester_id is distinct from (select auth.uid()) then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status not in ('picked_up', 'delivered') then
    raise exception 'The item has not been picked up yet' using errcode = 'HB010';
  end if;

  -- 4 random bytes from a secure source -> 000000..999999.
  code := lpad((abs(('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
                % 1000000)::text, 6, '0');

  insert into public.handover_codes (request_id, code_hash)
  values (p_request_id, encode(extensions.digest(p_request_id::text || ':' || code, 'sha256'), 'hex'))
  on conflict (request_id) do update
    set code_hash = excluded.code_hash, failed_attempts = 0, issued_at = now();

  return code;
end;
$$;

create function public.confirm_received(p_request_id uuid)
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
  if r.status <> 'delivered' then
    raise exception 'Nothing to confirm' using errcode = 'HB010';
  end if;
  perform public.settle_request(p_request_id, 'requester');
end;
$$;

/** Runs every 15 minutes: handovers nobody confirmed or disputed in time are settled. */
create function public.auto_confirm_deliveries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  settled integer := 0;
begin
  for due in
    select d.request_id
    from public.deliveries d
    join public.item_requests r on r.id = d.request_id
    where r.status = 'delivered'
      and d.delivery_method = 'handover'
      and d.settled_at is null
      and d.confirm_by <= now()
    for update of r skip locked
  loop
    perform public.settle_request(due.request_id, 'auto');
    settled := settled + 1;
  end loop;
  return settled;
end;
$$;

select cron.schedule('auto-confirm-deliveries', '*/15 * * * *', 'select public.auto_confirm_deliveries()');

-------------------------------------------------------------------------------
-- Disputes
-------------------------------------------------------------------------------
create function public.raise_dispute(p_request_id uuid, p_reason text)
returns public.disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  dispute public.disputes;
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
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Describe the problem in a few words' using errcode = 'HB027';
  end if;

  insert into public.disputes (request_id, raised_by, reason)
  values (p_request_id, (select auth.uid()), btrim(p_reason))
  returning * into dispute;
  -- Freezes payout: nothing settles a disputed request except an admin.
  update public.item_requests set status = 'disputed' where id = p_request_id;
  return dispute;
end;
$$;

/** Admin: release the held payment to the traveler. */
create function public.resolve_dispute_release(p_request_id uuid, p_note text default null)
returns public.disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispute public.disputes;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  select * into dispute from public.disputes
  where request_id = p_request_id and status = 'open'
  for update;
  if not found then
    raise exception 'No open dispute' using errcode = 'HB010';
  end if;

  perform public.settle_request(p_request_id, 'admin');
  update public.disputes
  set status = 'resolved', resolution = 'released', resolution_note = nullif(btrim(p_note), ''),
      resolved_by = auth.uid(), resolved_at = now()
  where id = dispute.id
  returning * into dispute;
  return dispute;
end;
$$;

/** Service role (resolve-dispute-refund Edge Function): may this admin refund it? */
create function public.admin_refund_quote(p_request_id uuid, p_user_id uuid)
returns public.payments
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.payments;
begin
  if not exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  if not exists (
    select 1 from public.disputes where request_id = p_request_id and status = 'open'
  ) then
    raise exception 'No open dispute' using errcode = 'HB010';
  end if;
  select * into p from public.payments
  where request_id = p_request_id and status in ('captured', 'refund_pending');
  if not found then
    raise exception 'No held payment' using errcode = 'HB024';
  end if;
  return p;
end;
$$;

create function public.close_dispute_refunded(p_request_id uuid, p_admin_id uuid, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.disputes
  set status = 'resolved', resolution = 'refunded', resolution_note = nullif(btrim(p_note), ''),
      resolved_by = p_admin_id, resolved_at = now()
  where request_id = p_request_id and status = 'open';
$$;

-- Refunds now also come from disputes (disputed -> refunded).
create or replace function public.record_refund_requested(p_payment_id uuid, p_razorpay_refund_id text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if p.status = 'captured' then
    update public.payments
    set status = 'refund_pending', razorpay_refund_id = p_razorpay_refund_id
    where id = p.id
    returning * into p;
    update public.offers set status = 'closed' where id = p.offer_id and status = 'accepted';
    update public.item_requests set status = 'refunded'
    where id = p.request_id and status in ('paid', 'disputed');
  end if;
  return p;
end;
$$;

create or replace function public.record_refund_processed(
  p_razorpay_payment_id text,
  p_razorpay_refund_id text,
  p_amount_paise integer
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
begin
  select * into p from public.payments where razorpay_payment_id = p_razorpay_payment_id for update;
  if not found then
    raise exception 'Unknown payment %', p_razorpay_payment_id using errcode = 'HB023';
  end if;
  if p_amount_paise <> p.amount_paise then
    raise exception 'Partial refunds are not supported' using errcode = 'HB023';
  end if;
  if p.status = 'refunded' then
    return p;
  end if;
  if p.status not in ('captured', 'refund_pending') then
    raise exception 'Payment % is not refundable', p_razorpay_payment_id using errcode = 'HB023';
  end if;

  update public.payments
  set status = 'refunded', razorpay_refund_id = p_razorpay_refund_id, refunded_at = now()
  where id = p.id
  returning * into p;

  perform public.ledger_post('refund:' || p_razorpay_refund_id, p.id, 'requester', 'held',
                             p.amount_paise);

  update public.offers set status = 'closed' where id = p.offer_id and status = 'accepted';
  update public.item_requests set status = 'refunded'
  where id = p.request_id and status in ('paid', 'disputed');

  return p;
end;
$$;

-------------------------------------------------------------------------------
-- Function access
-------------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  -- Clients (checks inside each function decide who may act).
  foreach fn in array array[
    'public.mark_picked_up(uuid, text, integer)',
    'public.confirm_delivery_code(uuid, text)',
    'public.mark_handed_over(uuid)',
    'public.issue_handover_code(uuid)',
    'public.confirm_received(uuid)',
    'public.raise_dispute(uuid, text)',
    'public.resolve_dispute_release(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- Internal or service role only.
  foreach fn in array array[
    'public.settle_request(uuid, text)',
    'public.auto_confirm_deliveries()',
    'public.admin_refund_quote(uuid, uuid)',
    'public.close_dispute_refunded(uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
