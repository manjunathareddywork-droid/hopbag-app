-- Phase 5: payments (Razorpay TEST mode). Hopbag never holds money: Razorpay
-- captures and holds it (see docs/PAYMENTS.md). This schema records what
-- Razorpay tells us, in paise, with an append-only double-entry ledger.
--
-- All writes come from Edge Functions using the service role, through the
-- functions below. Clients can only read their own payments.
--
-- New error codes:
--   HB022 request is not ready for payment   HB023 payment record mismatch
--   HB024 cannot refund at this stage

-------------------------------------------------------------------------------
-- Item price on requests (the requester states the shop price; decided 2026-10-04)
-------------------------------------------------------------------------------
alter table public.item_requests
  add column item_price_paise integer
    check (item_price_paise is null or item_price_paise between 100 and 1000000);

-- Required for new requests. Older requests keep working (status changes, expiry)
-- but cannot be paid until a price is added. A trigger, not a NOT VALID check,
-- because a check would also block status updates on those older rows.
create function public.item_requests_require_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_price_paise is null then
    raise exception 'Item price is required' using errcode = '23502';
  end if;
  return new;
end;
$$;

create trigger item_requests_require_price
  before insert or update of item_price_paise on public.item_requests
  for each row execute function public.item_requests_require_price();

grant insert (item_price_paise), update (item_price_paise) on public.item_requests to authenticated;

insert into public.app_settings (key, int_value, description) values
  ('platform_fee_bps', 1000, 'Platform fee on the carrying fare, in basis points (1000 = 10%)');

-------------------------------------------------------------------------------
-- Payments
-------------------------------------------------------------------------------
create type public.payment_status as enum ('created', 'captured', 'failed', 'refund_pending', 'refunded');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.item_requests (id) on delete restrict,
  offer_id uuid not null references public.offers (id) on delete restrict,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  traveler_id uuid not null references public.profiles (id) on delete restrict,
  item_price_paise integer not null check (item_price_paise > 0),
  fare_paise integer not null check (fare_paise > 0),
  amount_paise integer not null check (amount_paise = item_price_paise + fare_paise),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  razorpay_refund_id text unique,
  status public.payment_status not null default 'created',
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live payment per request (a failed one can be retried with a new order).
create unique index payments_one_live_per_request
  on public.payments (request_id) where status in ('created', 'captured', 'refund_pending', 'refunded');

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

create policy "Requester, traveler and admins see a payment"
  on public.payments for select
  to authenticated
  using (
    requester_id = (select auth.uid())
    or traveler_id = (select auth.uid())
    or (select public.is_admin())
  );

-------------------------------------------------------------------------------
-- Ledger: append-only, double entry. Every transaction's rows sum to zero.
-- Accounts: requester (money in/out), held (held by Razorpay for the trip).
-- Phase 6 adds traveler and platform_fee when funds are released.
-------------------------------------------------------------------------------
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_key text not null,
  payment_id uuid not null references public.payments (id) on delete restrict,
  account text not null check (account in ('requester', 'held', 'traveler', 'platform_fee')),
  amount_paise integer not null check (amount_paise <> 0),
  created_at timestamptz not null default now(),
  -- Idempotency: the same event can never post twice.
  unique (txn_key, account)
);

create index ledger_entries_payment_idx on public.ledger_entries (payment_id);

alter table public.ledger_entries enable row level security;

revoke all on public.ledger_entries from anon, authenticated;
grant select on public.ledger_entries to authenticated;

create policy "Admins can read the ledger"
  on public.ledger_entries for select
  to authenticated
  using ((select public.is_admin()));

create function public.ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Ledger entries cannot be changed or deleted';
end;
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_append_only();

/** Posts a balanced two-leg transaction once; returns false if it was already posted. */
create function public.ledger_post(
  p_txn_key text,
  p_payment_id uuid,
  p_debit text,
  p_credit text,
  p_amount integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.ledger_entries (txn_key, payment_id, account, amount_paise)
  values (p_txn_key, p_payment_id, p_debit, p_amount),
         (p_txn_key, p_payment_id, p_credit, -p_amount)
  on conflict (txn_key, account) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 2;
end;
$$;

-------------------------------------------------------------------------------
-- Webhook events: stored once by Razorpay's event id, so replays are ignored.
-------------------------------------------------------------------------------
create table public.webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
grant select on public.webhook_events to authenticated;

create policy "Admins can read webhook events"
  on public.webhook_events for select
  to authenticated
  using ((select public.is_admin()));

-- Edge Functions (service role) store events and read payments directly; every
-- other write goes through the security definer functions below.
grant select, insert, update on public.webhook_events to service_role;
grant select on public.payments, public.ledger_entries to service_role;

-------------------------------------------------------------------------------
-- Service-role functions (called by Edge Functions; not callable by clients)
-------------------------------------------------------------------------------

/** What the requester must pay for an accepted request, or an error. */
create function public.payment_quote(p_request_id uuid, p_user_id uuid)
returns table (
  request_id uuid,
  offer_id uuid,
  traveler_id uuid,
  item_name text,
  item_price_paise integer,
  fare_paise integer,
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
begin
  select * into r from public.item_requests where id = p_request_id;
  if not found or r.requester_id is distinct from p_user_id then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'accepted' or r.accepted_offer_id is null or r.item_price_paise is null then
    raise exception 'Request is not ready for payment' using errcode = 'HB022';
  end if;
  select * into o from public.offers where id = r.accepted_offer_id;

  return query
  select r.id, o.id, o.traveler_id, r.item_name, r.item_price_paise, o.fare_paise,
         r.item_price_paise + o.fare_paise,
         (select p.razorpay_order_id from public.payments p
          where p.request_id = r.id and p.status = 'created'
            and p.amount_paise = r.item_price_paise + o.fare_paise
          limit 1);
end;
$$;

create function public.record_order_created(
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
  -- A stale unpaid order (e.g. amount changed) is replaced.
  update public.payments set status = 'failed'
  where request_id = p_request_id and status = 'created';

  insert into public.payments
    (request_id, offer_id, requester_id, traveler_id, item_price_paise, fare_paise,
     amount_paise, razorpay_order_id)
  values
    (q.request_id, q.offer_id, p_user_id, q.traveler_id, q.item_price_paise, q.fare_paise,
     q.amount_paise, p_razorpay_order_id)
  returning * into p;
  return p;
end;
$$;

/**
 * Called after a verified checkout or a payment.captured / order.paid webhook.
 * Idempotent: a second call for the same payment changes nothing.
 */
create function public.record_payment_captured(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
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
  select * into p from public.payments where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    raise exception 'Unknown order %', p_razorpay_order_id using errcode = 'HB023';
  end if;
  if p.amount_paise <> p_amount_paise then
    raise exception 'Amount mismatch for %', p_razorpay_order_id using errcode = 'HB023';
  end if;
  if p.razorpay_payment_id is not null and p.razorpay_payment_id <> p_razorpay_payment_id then
    raise exception 'Order % already paid by another payment', p_razorpay_order_id
      using errcode = 'HB023';
  end if;
  if p.status in ('captured', 'refund_pending', 'refunded') then
    return p; -- already recorded
  end if;

  update public.payments
  set status = 'captured', razorpay_payment_id = p_razorpay_payment_id, captured_at = now()
  where id = p.id
  returning * into p;

  perform public.ledger_post('capture:' || p_razorpay_payment_id, p.id, 'held', 'requester',
                             p.amount_paise);

  update public.item_requests set status = 'paid'
  where id = p.request_id and status = 'accepted';

  return p;
end;
$$;

create function public.record_payment_failed(p_razorpay_order_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set status = 'failed'
  where razorpay_order_id = p_razorpay_order_id and status = 'created';
$$;

/** Can this user get a refund for this request right now? Returns the payment. */
create function public.refund_quote(p_request_id uuid, p_user_id uuid)
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
  if not found or r.requester_id is distinct from p_user_id then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  select * into p from public.payments
  where request_id = p_request_id and status in ('captured', 'refund_pending');
  -- Before pickup only (PRODUCT.md): once picked up, problems go to a dispute.
  if not found or r.status <> 'paid' then
    raise exception 'This request cannot be refunded now' using errcode = 'HB024';
  end if;
  return p;
end;
$$;

/** Refund requested from Razorpay; the request is cancelled-with-refund and trip space is freed. */
create function public.record_refund_requested(p_payment_id uuid, p_razorpay_refund_id text)
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
    where id = p.request_id and status = 'paid';
  end if;
  return p;
end;
$$;

/** refund.processed webhook (or a processed refund response). Idempotent. */
create function public.record_refund_processed(
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
  where id = p.request_id and status = 'paid';

  return p;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.payment_quote(uuid, uuid)',
    'public.record_order_created(uuid, uuid, text)',
    'public.record_payment_captured(text, text, integer)',
    'public.record_payment_failed(text)',
    'public.refund_quote(uuid, uuid)',
    'public.record_refund_requested(uuid, text)',
    'public.record_refund_processed(text, text, integer)',
    'public.ledger_post(text, uuid, text, text, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Requesters cancel paid requests through the refund Edge Function, not here.
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
  -- An unpaid order for this request is abandoned.
  update public.payments set status = 'failed'
  where payments.request_id = cancel_request.request_id and status = 'created';
  update public.item_requests set status = 'cancelled'
  where id = cancel_request.request_id
  returning * into request;
  return request;
end;
$$;

-------------------------------------------------------------------------------
-- The route feed also returns the item price, so travelers know what they buy.
-- (Return type changes, so drop and recreate.)
-------------------------------------------------------------------------------
drop function public.request_feed(uuid);

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
  item_price_paise integer,
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
    r.from_city_id, r.to_city_id, r.deadline, r.budget_paise, r.item_price_paise, r.photo_path,
    r.status,
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
