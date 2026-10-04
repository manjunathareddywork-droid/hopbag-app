-- Phase 8: report and block users, admin suspension, rate limits, error and
-- event logging, and admin reporting (dashboard, funnel, error groups).
--
-- New error codes:
--   HB030 blocked between these two people   HB031 account suspended
--   HB032 too many attempts, slow down

-------------------------------------------------------------------------------
-- Rate limits: fixed windows per key. Used by Edge Functions (service role) and
-- by database triggers and functions for spam-prone actions.
-------------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant select on public.rate_limits to authenticated;

create policy "Admins can see rate limit counters"
  on public.rate_limits for select
  to authenticated
  using ((select public.is_admin()));

/** Counts one hit; true while the key is within its limit for the current window. */
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end;
$$;

create function public.enforce_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.hit_rate_limit(p_key, p_limit, p_window_seconds) then
    raise exception 'Too many attempts. Please wait a little.' using errcode = 'HB032';
  end if;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

select cron.schedule('clean-rate-limits', '17 * * * *',
  $$ delete from public.rate_limits where window_start < now() - interval '1 day' $$);

-------------------------------------------------------------------------------
-- Suspension (admins). A suspended person can sign in and read, but cannot post
-- requests, trips, offers, messages or reports.
-------------------------------------------------------------------------------
-- Its own table, not profile columns: profiles are readable by every signed-in
-- user, and the reason for a suspension must not be.
create table public.account_suspensions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 300),
  suspended_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.account_suspensions enable row level security;
revoke all on public.account_suspensions from anon, authenticated;
grant select on public.account_suspensions to authenticated;

create policy "People see their own suspension, admins see all"
  on public.account_suspensions for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

/** Only answers about yourself (or for admins and server code), so it cannot be used to probe others. */
create function public.is_suspended(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.account_suspensions where user_id = p_user_id)
     and ((select auth.uid()) is null or (select auth.uid()) = p_user_id or public.is_admin());
$$;

revoke execute on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Blocks: either person blocking the other stops new contact both ways.
-------------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;

create policy "Users see who they blocked"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Users block others"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "Users unblock"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

/** Only answers when the caller is one of the two (or server code), so it cannot be used to probe others. */
create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.uid()) is null or (select auth.uid()) in (p_a, p_b))
     and exists (
       select 1 from public.user_blocks
       where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
     );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Blocked people do not see each other's open requests (and so not in the feed).
drop policy "Verified travelers see open requests" on public.item_requests;
create policy "Verified travelers see open requests"
  on public.item_requests for select
  to authenticated
  using (
    status in ('open', 'offered')
    and public.is_verified_traveler((select auth.uid()))
    and not public.is_blocked_between((select auth.uid()), requester_id)
  );

-------------------------------------------------------------------------------
-- Enforcement on writes: suspension, blocks, rate limits
-------------------------------------------------------------------------------
drop policy "Users can create requests for themselves" on public.item_requests;
create policy "Users can create requests for themselves"
  on public.item_requests for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'open'
    and not public.is_suspended((select auth.uid()))
  );

drop policy "Users add their own trips" on public.trips;
create policy "Users add their own trips"
  on public.trips for insert
  to authenticated
  with check (
    traveler_id = (select auth.uid())
    and status = 'active'
    and ticket_status = 'pending'
    and not public.is_suspended((select auth.uid()))
  );

create function public.item_requests_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('requests:' || new.requester_id, 20, 86400);
  return new;
end;
$$;

create trigger item_requests_rate_limit
  before insert on public.item_requests
  for each row execute function public.item_requests_rate_limit();

create function public.offers_safety_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := (select requester_id from public.item_requests where id = new.request_id);
begin
  if public.is_suspended(new.traveler_id) then
    raise exception 'Account suspended' using errcode = 'HB031';
  end if;
  if public.is_blocked_between(new.traveler_id, requester) then
    raise exception 'Blocked' using errcode = 'HB030';
  end if;
  perform public.enforce_rate_limit('offers:' || new.traveler_id, 30, 3600);
  return new;
end;
$$;

create trigger offers_safety_checks
  before insert on public.offers
  for each row execute function public.offers_safety_checks();

create function public.messages_safety_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  other uuid;
begin
  if public.is_suspended(new.sender_id) then
    raise exception 'Account suspended' using errcode = 'HB031';
  end if;
  select * into r from public.item_requests where id = new.request_id;
  other := case when new.sender_id = r.requester_id
                then public.request_traveler(r.id) else r.requester_id end;
  if public.is_blocked_between(new.sender_id, other) then
    raise exception 'Blocked' using errcode = 'HB030';
  end if;
  perform public.enforce_rate_limit('messages:' || new.sender_id, 30, 60);
  return new;
end;
$$;

create trigger messages_safety_checks
  before insert on public.messages
  for each row execute function public.messages_safety_checks();

-------------------------------------------------------------------------------
-- Reports
-------------------------------------------------------------------------------
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.item_requests (id) on delete set null,
  category text not null check (category in ('fraud', 'abuse', 'no_show', 'prohibited_item', 'other')),
  details text not null default '' check (details = btrim(details) and char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index user_reports_open_idx on public.user_reports (created_at) where status = 'open';
create index user_reports_reported_idx on public.user_reports (reported_user_id);

alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;
grant select on public.user_reports to authenticated;
grant insert (reported_user_id, request_id, category, details) on public.user_reports to authenticated;

create policy "Reporters see their reports, admins see all"
  on public.user_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users report others"
  on public.user_reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

create function public.user_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('reports:' || new.reporter_id, 10, 86400);
  return new;
end;
$$;

create trigger user_reports_rate_limit
  before insert on public.user_reports
  for each row execute function public.user_reports_rate_limit();

/** Admin: close a report, optionally suspending the reported person. */
create function public.review_report(p_report_id uuid, p_note text, p_suspend boolean default false)
returns public.user_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  report public.user_reports;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  update public.user_reports
  set status = 'reviewed', admin_note = nullif(btrim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_report_id and status = 'open'
  returning * into report;
  if not found then
    raise exception 'Report not found or already reviewed' using errcode = 'HB010';
  end if;
  if p_suspend then
    insert into public.account_suspensions (user_id, reason, suspended_by)
    values (report.reported_user_id,
            left(coalesce(nullif(btrim(p_note), ''), report.category), 300), auth.uid())
    on conflict (user_id) do nothing;
  end if;
  return report;
end;
$$;

create function public.set_suspension(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Admins cannot suspend themselves' using errcode = 'HB010';
  end if;
  if p_suspended then
    insert into public.account_suspensions (user_id, reason, suspended_by)
    values (p_user_id, left(nullif(btrim(p_reason), ''), 300), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason;
  else
    delete from public.account_suspensions where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.review_report(uuid, text, boolean) from public, anon;
revoke execute on function public.set_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.review_report(uuid, text, boolean) to authenticated;
grant execute on function public.set_suspension(uuid, boolean, text) to authenticated;

-------------------------------------------------------------------------------
-- Error and event logging (our own instead of a third-party service).
-- Anyone may write (errors can happen before sign-in); only admins read.
-- Floods are dropped silently by rate limits, never surfaced to the user.
-------------------------------------------------------------------------------
create table public.app_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('crash', 'error', 'promise')),
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (stack is null or char_length(stack) <= 8000),
  screen text check (screen is null or char_length(screen) <= 200),
  fingerprint text not null check (char_length(fingerprint) between 1 and 64),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  platform text check (platform is null or char_length(platform) <= 16),
  os_version text check (os_version is null or char_length(os_version) <= 32),
  device_model text check (device_model is null or char_length(device_model) <= 64),
  created_at timestamptz not null default now()
);

create index app_errors_created_idx on public.app_errors (created_at desc);
create index app_errors_fingerprint_idx on public.app_errors (fingerprint, created_at desc);

create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (name in (
    'app_opened', 'otp_requested', 'signed_in', 'onboarding_completed', 'request_form_opened',
    'request_posted', 'feed_opened', 'offer_sent', 'offer_accepted', 'checkout_opened',
    'payment_completed', 'payment_failed', 'pickup_marked', 'delivery_confirmed', 'chat_opened',
    'rating_sent', 'report_sent', 'user_blocked'
  )),
  properties jsonb not null default '{}' check (pg_column_size(properties) <= 2000),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  platform text check (platform is null or char_length(platform) <= 16),
  created_at timestamptz not null default now()
);

create index app_events_name_idx on public.app_events (name, created_at desc);

alter table public.app_errors enable row level security;
alter table public.app_events enable row level security;

revoke all on public.app_errors, public.app_events from anon, authenticated;
grant select on public.app_errors, public.app_events to authenticated;
grant insert (kind, message, stack, screen, fingerprint, app_version, platform, os_version, device_model)
  on public.app_errors to anon, authenticated;
grant insert (name, properties, app_version, platform) on public.app_events to anon, authenticated;

create policy "Anyone can report an error"
  on public.app_errors for insert
  to anon, authenticated
  with check (user_id is not distinct from auth.uid());

create policy "Admins read errors"
  on public.app_errors for select
  to authenticated
  using ((select public.is_admin()));

create policy "Anyone can log an event"
  on public.app_events for insert
  to anon, authenticated
  with check (user_id is not distinct from auth.uid());

create policy "Admins read events"
  on public.app_events for select
  to authenticated
  using ((select public.is_admin()));

-- Drops (returns null) instead of raising: logging must never break the app.
create function public.app_logs_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text := coalesce(auth.uid()::text, 'anon');
begin
  if tg_table_name = 'app_errors' then
    if not public.hit_rate_limit('errors:' || who, case when who = 'anon' then 60 else 30 end, 60) then
      return null;
    end if;
  elsif not public.hit_rate_limit('events:' || who, case when who = 'anon' then 120 else 120 end, 60) then
    return null;
  end if;
  return new;
end;
$$;

create trigger app_errors_rate_limit
  before insert on public.app_errors
  for each row execute function public.app_logs_rate_limit();

create trigger app_events_rate_limit
  before insert on public.app_events
  for each row execute function public.app_logs_rate_limit();

select cron.schedule('trim-app-logs', '23 3 * * *', $$
  delete from public.app_errors where created_at < now() - interval '90 days';
  delete from public.app_events where created_at < now() - interval '180 days';
$$);

-------------------------------------------------------------------------------
-- Admin reporting
-------------------------------------------------------------------------------
create function public.admin_dashboard()
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
    'held_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'held'),
    'released_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'traveler'),
    'fees_paise', (select coalesce(sum(amount_paise), 0) from public.ledger_entries where account = 'platform_fee'),
    'errors_24h', (select count(*) from public.app_errors where created_at > now() - interval '24 hours')
  );
end;
$$;

/** Funnel over the last N days, from the business tables (the source of truth). */
create function public.admin_funnel(p_days integer default 30)
returns table (step text, count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => p_days);
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  return query
  with reqs as (select * from public.item_requests where created_at >= since)
  select s.step, s.n from (values
    (1, 'signed_up', (select count(*) from public.profiles where created_at >= since)),
    (2, 'requests_posted', (select count(*) from reqs)),
    (3, 'got_an_offer', (select count(*) from reqs r
                         where exists (select 1 from public.offers o where o.request_id = r.id))),
    (4, 'offer_accepted', (select count(*) from reqs where accepted_offer_id is not null)),
    (5, 'paid', (select count(*) from reqs r
                 where exists (select 1 from public.payments p
                               where p.request_id = r.id and p.captured_at is not null))),
    (6, 'picked_up', (select count(*) from reqs r
                      where exists (select 1 from public.deliveries d where d.request_id = r.id))),
    (7, 'completed', (select count(*) from reqs where status = 'settled')),
    (8, 'rated', (select count(distinct r.id) from reqs r
                  join public.ratings g on g.request_id = r.id))
  ) as s (ord, step, n)
  order by s.ord;
end;
$$;

/** Errors grouped by fingerprint over the last N hours. */
create function public.admin_error_groups(p_hours integer default 24)
returns table (fingerprint text, message text, screen text, occurrences bigint, users bigint, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'HB012';
  end if;
  return query
  select e.fingerprint, (array_agg(e.message order by e.id desc))[1],
         (array_agg(e.screen order by e.id desc))[1],
         count(*), count(distinct e.user_id), max(e.created_at)
  from public.app_errors e
  where e.created_at > now() - make_interval(hours => p_hours)
  group by e.fingerprint
  order by count(*) desc
  limit 50;
end;
$$;

revoke execute on function public.admin_dashboard() from public, anon;
revoke execute on function public.admin_funnel(integer) from public, anon;
revoke execute on function public.admin_error_groups(integer) from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_funnel(integer) to authenticated;
grant execute on function public.admin_error_groups(integer) to authenticated;

-------------------------------------------------------------------------------
-- Security review follow-ups (docs/SECURITY_REVIEW.md)
-------------------------------------------------------------------------------

-- Helpers that signed-out users never need. (Postgres grants EXECUTE to PUBLIC
-- by default; these were reachable by anon through the API, harmlessly.)
revoke execute on function public.find_blocked_term(text) from public, anon;
revoke execute on function public.setting(text) from public, anon;
revoke execute on function public.today_ist() from public, anon;
revoke execute on function public.request_transition_allowed(public.request_status, public.request_status)
  from public, anon;
grant execute on function public.find_blocked_term(text) to authenticated;
grant execute on function public.setting(text) to authenticated;
grant execute on function public.today_ist() to authenticated;
grant execute on function public.request_transition_allowed(public.request_status, public.request_status)
  to authenticated;

-- Indexes for foreign keys used in lookups and RLS checks (advisor: unindexed_foreign_keys).
create index if not exists item_requests_accepted_offer_idx on public.item_requests (accepted_offer_id);
create index if not exists payments_offer_idx on public.payments (offer_id);
create index if not exists payments_traveler_idx on public.payments (traveler_id);
create index if not exists payments_requester_idx on public.payments (requester_id);
create index if not exists payouts_traveler_idx on public.payouts (traveler_id);
create index if not exists payouts_request_idx on public.payouts (request_id);
create index if not exists deliveries_traveler_idx on public.deliveries (traveler_id);
create index if not exists disputes_request_idx on public.disputes (request_id);
create index if not exists profiles_home_city_idx on public.profiles (home_city_id);
