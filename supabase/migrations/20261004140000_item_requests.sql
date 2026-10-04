-- Phase 2: item requests, with the allowlist and status rules enforced here
-- (not only in the app). Errors use custom SQLSTATEs the app maps to messages:
--   HB001 blocked item (detail = reason_code)   HB002 category not allowed
--   HB003 too heavy for category                HB004 same-state route
--   HB005 deadline out of range                 HB010 invalid status change
--   HB011 not allowed to change this request

create type public.request_status as enum (
  'draft', 'open', 'offered', 'accepted', 'paid', 'picked_up', 'delivered', 'settled',
  'cancelled', 'expired', 'disputed', 'refunded'
);

create table public.item_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category_id text not null references public.allowed_categories (id),
  item_name text not null
    check (item_name = btrim(item_name) and char_length(item_name) between 2 and 80),
  details text not null default ''
    check (details = btrim(details) and char_length(details) <= 500),
  weight_grams integer not null check (weight_grams between 1 and 5000),
  from_city_id integer not null references public.cities (id),
  to_city_id integer not null references public.cities (id),
  deadline date not null,
  -- Money in paise. Rs 50 to Rs 10,000 for now; Phase 4 adds the per-kg fare band.
  budget_paise integer not null check (budget_paise between 5000 and 1000000),
  photo_path text check (photo_path is null or photo_path like requester_id::text || '/%'),
  status public.request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_city_id <> to_city_id)
);

create index item_requests_requester_idx on public.item_requests (requester_id, created_at desc);
create index item_requests_route_idx on public.item_requests (from_city_id, to_city_id)
  where status in ('open', 'offered');

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

/** India date; the server clock is UTC. */
create function public.today_ist()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

/** First blocked term found in the text, or no row. Same matching as the app. */
create function public.find_blocked_term(content text)
returns table (pattern text, reason_code text)
language sql
stable
set search_path = ''
as $$
  select b.pattern, b.reason_code
  from public.blocked_terms b
  where content ~* ('\m(' || b.pattern || ')\M')
  order by b.id
  limit 1;
$$;

/** The request lifecycle from docs/PRODUCT.md. */
create function public.request_transition_allowed(
  from_status public.request_status,
  to_status public.request_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from (values
      ('draft'::public.request_status, 'open'::public.request_status),
      ('draft', 'cancelled'),
      ('open', 'offered'), ('open', 'cancelled'), ('open', 'expired'),
      ('offered', 'accepted'), ('offered', 'open'), ('offered', 'cancelled'), ('offered', 'expired'),
      ('accepted', 'paid'), ('accepted', 'cancelled'),
      ('paid', 'picked_up'), ('paid', 'refunded'), ('paid', 'disputed'),
      ('picked_up', 'delivered'), ('picked_up', 'disputed'),
      ('delivered', 'settled'), ('delivered', 'disputed'),
      ('disputed', 'settled'), ('disputed', 'refunded')
    ) as t (f, s)
    where t.f = from_status and t.s = to_status
  );
$$;

-------------------------------------------------------------------------------
-- Validation trigger: allowlist, blocked items, weight, inter-state, deadline.
-- On update, content rules re-run only when content changes, so a later
-- category deactivation does not block status changes on old requests.
-------------------------------------------------------------------------------
create function public.item_requests_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category public.allowed_categories%rowtype;
  blocked record;
  from_state text;
  to_state text;
begin
  if tg_op = 'UPDATE'
    and new.category_id is not distinct from old.category_id
    and new.item_name is not distinct from old.item_name
    and new.details is not distinct from old.details
    and new.weight_grams is not distinct from old.weight_grams
    and new.from_city_id is not distinct from old.from_city_id
    and new.to_city_id is not distinct from old.to_city_id
    and new.deadline is not distinct from old.deadline
  then
    return new;
  end if;

  select * into category from public.allowed_categories where id = new.category_id;
  if not found or not category.is_active then
    raise exception 'Category % is not allowed', new.category_id
      using errcode = 'HB002';
  end if;

  select * into blocked from public.find_blocked_term(new.item_name || ' ' || new.details);
  if found then
    raise exception 'Item is not allowed: matches "%"', blocked.pattern
      using errcode = 'HB001', detail = blocked.reason_code;
  end if;

  if new.weight_grams > category.max_weight_grams then
    raise exception 'Too heavy for %: max % g', category.id, category.max_weight_grams
      using errcode = 'HB003', detail = category.max_weight_grams::text;
  end if;

  select state_code into from_state from public.cities where id = new.from_city_id;
  select state_code into to_state from public.cities where id = new.to_city_id;
  if from_state = to_state then
    raise exception 'Pickup and delivery cities must be in different states'
      using errcode = 'HB004';
  end if;

  if new.deadline < public.today_ist() + 1 or new.deadline > public.today_ist() + 90 then
    raise exception 'Deadline must be between tomorrow and 90 days from today'
      using errcode = 'HB005';
  end if;

  return new;
end;
$$;

create trigger item_requests_validate
  before insert or update on public.item_requests
  for each row execute function public.item_requests_validate();

-- Status may only move along the lifecycle, whoever makes the change.
create function public.item_requests_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and not public.request_transition_allowed(old.status, new.status)
  then
    raise exception 'Cannot change request from % to %', old.status, new.status
      using errcode = 'HB010';
  end if;
  return new;
end;
$$;

create trigger item_requests_guard_status
  before update on public.item_requests
  for each row execute function public.item_requests_guard_status();

create trigger item_requests_set_updated_at
  before update on public.item_requests
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Access. Requesters see and edit only their own requests; Phase 4 opens
-- open requests to travelers. requester_id and status are not client-writable:
-- requester_id defaults to auth.uid(), status starts 'open' and changes only
-- through the functions below (and later phases' functions).
-------------------------------------------------------------------------------
alter table public.item_requests enable row level security;

revoke all on public.item_requests from anon, authenticated;
grant select on public.item_requests to authenticated;
grant insert (
  category_id, item_name, details, weight_grams, from_city_id, to_city_id,
  deadline, budget_paise, photo_path
) on public.item_requests to authenticated;
grant update (
  category_id, item_name, details, weight_grams, from_city_id, to_city_id,
  deadline, budget_paise, photo_path
) on public.item_requests to authenticated;

create policy "Requesters can read their own requests"
  on public.item_requests for select
  to authenticated
  using (requester_id = (select auth.uid()));

create policy "Users can create requests for themselves"
  on public.item_requests for insert
  to authenticated
  with check (requester_id = (select auth.uid()) and status = 'open');

create policy "Requesters can edit open requests"
  on public.item_requests for update
  to authenticated
  using (requester_id = (select auth.uid()) and status in ('draft', 'open'))
  with check (requester_id = (select auth.uid()) and status in ('draft', 'open'));

-------------------------------------------------------------------------------
-- Status functions
-------------------------------------------------------------------------------
create function public.cancel_request(request_id uuid)
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
  if request.status not in ('draft', 'open', 'offered') then
    raise exception 'Request can no longer be cancelled' using errcode = 'HB010';
  end if;

  update public.item_requests set status = 'cancelled' where id = request_id
  returning * into request;
  return request;
end;
$$;

revoke execute on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;

/** Marks open/offered requests past their deadline as expired. Run daily by pg_cron. */
create function public.expire_overdue_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.item_requests
  set status = 'expired'
  where status in ('open', 'offered') and deadline < public.today_ist();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.expire_overdue_requests() from public, anon, authenticated;

create extension if not exists pg_cron;

-- 00:05 IST daily (18:35 UTC).
select cron.schedule(
  'expire-overdue-requests',
  '35 18 * * *',
  'select public.expire_overdue_requests()'
);

-------------------------------------------------------------------------------
-- Request photos: private bucket, per-user folders. Only the owner can see them
-- for now; Phase 4 lets travelers see photos of requests they can view.
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users can view their own request photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own request photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own request photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own request photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
