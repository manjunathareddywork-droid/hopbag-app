-- Phase 7: chat per accepted request (Realtime), phone-number blocking, in-app
-- notifications with push delivery, and mutual ratings after settlement.
--
-- New error codes:
--   HB028 phone numbers cannot be shared yet

-------------------------------------------------------------------------------
-- Phone numbers: blocked in offers (before anyone is chosen) and in chat until
-- payment, so deals cannot move off Hopbag before the money is held.
-- Same matching in the app: src/features/chat/phone.ts.
-------------------------------------------------------------------------------
create function public.contains_phone_number(content text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Join digits split by spaces, dots, dashes or brackets ("98765 43210"), then
  -- look for an Indian mobile number, with or without +91 / 0.
  select regexp_replace(coalesce(content, ''), '([0-9])[[:space:]().-]+(?=[0-9])', '\1', 'g')
         ~ '(^|[^0-9])(\+?91|0)?[6-9][0-9]{9}($|[^0-9])';
$$;

/** Request statuses in which the two people may share phone numbers. */
create function public.phone_sharing_allowed(status public.request_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select status in ('paid', 'picked_up', 'delivered', 'disputed', 'settled');
$$;

/** Request statuses in which the chat is open for new messages. */
create function public.chat_open(status public.request_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select status in ('accepted', 'paid', 'picked_up', 'delivered', 'disputed');
$$;

create function public.offers_block_phone_numbers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.contains_phone_number(new.message) then
    raise exception 'Phone numbers cannot be shared before payment' using errcode = 'HB028';
  end if;
  return new;
end;
$$;

create trigger offers_block_phone_numbers
  before insert on public.offers
  for each row execute function public.offers_block_phone_numbers();

-------------------------------------------------------------------------------
-- Chat
-------------------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.item_requests (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (body = btrim(body) and char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_request_idx on public.messages (request_id, id);

/** The requester or the chosen traveler of this request. */
create function public.is_chat_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.item_requests r
    where r.id = p_request_id
      and r.accepted_offer_id is not null
      and (
        r.requester_id = (select auth.uid())
        or public.request_traveler(r.id) = (select auth.uid())
      )
  );
$$;

create function public.request_status_of(p_request_id uuid)
returns public.request_status
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.item_requests where id = p_request_id;
$$;

revoke execute on function public.is_chat_participant(uuid) from public, anon;
revoke execute on function public.request_status_of(uuid) from public, anon;
grant execute on function public.is_chat_participant(uuid) to authenticated;
grant execute on function public.request_status_of(uuid) to authenticated;

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (request_id, body) on public.messages to authenticated;

create policy "The two people (and admins, for disputes) read the chat"
  on public.messages for select
  to authenticated
  using (public.is_chat_participant(request_id) or (select public.is_admin()));

create policy "The two people write while the request is in progress"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_chat_participant(request_id)
    and public.chat_open(public.request_status_of(request_id))
  );

create function public.messages_block_phone_numbers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.phone_sharing_allowed(public.request_status_of(new.request_id))
    and public.contains_phone_number(new.body)
  then
    raise exception 'Phone numbers can be shared after payment' using errcode = 'HB028';
  end if;
  return new;
end;
$$;

create trigger messages_block_phone_numbers
  before insert on public.messages
  for each row execute function public.messages_block_phone_numbers();

-------------------------------------------------------------------------------
-- Notifications: one row per person per event. Shown in the app (Updates) and
-- sent as push notifications by the send-notifications Edge Function.
-------------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'offer_received', 'offer_accepted', 'offer_not_chosen', 'request_paid', 'picked_up',
    'handed_over', 'completed', 'payout_unlocked', 'disputed', 'dispute_resolved', 'refunded',
    'expired', 'message', 'rated', 'id_approved', 'id_rejected', 'ticket_approved',
    'ticket_rejected'
  )),
  request_id uuid references public.item_requests (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  -- Values for the message text (item name, amount, names). The app and the push
  -- function turn kind + params into words, so the text can be translated.
  params jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_claimed_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, id desc);
create index notifications_unpushed_idx on public.notifications (id) where push_claimed_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users see their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.notify(
  p_user_id uuid,
  p_kind text,
  p_request_id uuid default null,
  p_trip_id uuid default null,
  p_params jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, request_id, trip_id, params)
  select p_user_id, p_kind, p_request_id, p_trip_id, coalesce(p_params, '{}')
  where p_user_id is not null;
$$;

revoke execute on function public.notify(uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated;

create function public.first_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(full_name, ' ', 1) from public.profiles where id = p_user_id;
$$;

revoke execute on function public.first_name(uuid) from public, anon, authenticated;

-- New offer -> requester.
create function public.notify_offer_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
begin
  select * into r from public.item_requests where id = new.request_id;
  perform public.notify(r.requester_id, 'offer_received', r.id, null, jsonb_build_object(
    'item', r.item_name, 'amount', new.fare_paise, 'name', public.first_name(new.traveler_id)));
  return new;
end;
$$;

create trigger offers_notify_created
  after insert on public.offers
  for each row execute function public.notify_offer_created();

-- Offer accepted / not chosen -> traveler.
create function public.notify_offer_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item text := (select item_name from public.item_requests where id = new.request_id);
begin
  if new.status = 'accepted' then
    perform public.notify(new.traveler_id, 'offer_accepted', new.request_id, new.trip_id,
                          jsonb_build_object('item', item, 'amount', new.fare_paise));
  elsif new.status = 'rejected' then
    perform public.notify(new.traveler_id, 'offer_not_chosen', new.request_id, new.trip_id,
                          jsonb_build_object('item', item));
  end if;
  return new;
end;
$$;

create trigger offers_notify_status
  after update of status on public.offers
  for each row when (old.status is distinct from new.status)
  execute function public.notify_offer_status();

-- Request status changes -> the people involved.
create function public.notify_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  traveler uuid := public.request_traveler(new.id);
  params jsonb := jsonb_build_object('item', new.item_name);
  d public.deliveries;
  payout integer;
begin
  case new.status
    when 'paid' then
      perform public.notify(traveler, 'request_paid', new.id, null, params);
    when 'picked_up' then
      perform public.notify(new.requester_id, 'picked_up', new.id, null, params);
    when 'delivered' then
      select * into d from public.deliveries where request_id = new.id;
      if d.delivery_method = 'handover' then
        perform public.notify(new.requester_id, 'handed_over', new.id, null,
                              params || jsonb_build_object('deadline', d.confirm_by));
      end if;
    when 'settled' then
      select net_paise into payout from public.payouts where request_id = new.id;
      perform public.notify(new.requester_id, 'completed', new.id, null, params);
      perform public.notify(traveler, 'payout_unlocked', new.id, null,
                            params || jsonb_build_object('amount', payout));
    when 'disputed' then
      perform public.notify(new.requester_id, 'disputed', new.id, null, params);
      perform public.notify(traveler, 'disputed', new.id, null, params);
    when 'refunded' then
      perform public.notify(new.requester_id, 'refunded', new.id, null, params);
      perform public.notify(traveler, 'refunded', new.id, null, params);
    when 'expired' then
      perform public.notify(new.requester_id, 'expired', new.id, null, params);
    else
      null;
  end case;
  return new;
end;
$$;

create trigger item_requests_notify_status
  after update of status on public.item_requests
  for each row when (old.status is distinct from new.status)
  execute function public.notify_request_status();

-- Dispute resolved -> both.
create function public.notify_dispute_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.item_requests;
  params jsonb;
begin
  select * into r from public.item_requests where id = new.request_id;
  params := jsonb_build_object('item', r.item_name, 'resolution', new.resolution);
  perform public.notify(r.requester_id, 'dispute_resolved', r.id, null, params);
  perform public.notify(public.request_traveler(r.id), 'dispute_resolved', r.id, null, params);
  return new;
end;
$$;

create trigger disputes_notify_resolved
  after update of status on public.disputes
  for each row when (old.status = 'open' and new.status = 'resolved')
  execute function public.notify_dispute_resolved();

-- New chat message -> the other person.
create function public.notify_message()
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
    'preview', left(new.body, 80)));
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message();

-- ID and ticket reviews -> traveler.
create function public.notify_verification_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    perform public.notify(new.user_id, 'id_approved');
  elsif new.status = 'rejected' then
    perform public.notify(new.user_id, 'id_rejected', null, null,
                          jsonb_build_object('reason', new.reject_reason));
  end if;
  return new;
end;
$$;

create trigger traveler_verifications_notify
  after update of status on public.traveler_verifications
  for each row when (old.status is distinct from new.status)
  execute function public.notify_verification_reviewed();

create function public.notify_ticket_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ticket_status = 'approved' then
    perform public.notify(new.traveler_id, 'ticket_approved', null, new.id);
  elsif new.ticket_status = 'rejected' then
    perform public.notify(new.traveler_id, 'ticket_rejected', null, new.id,
                          jsonb_build_object('reason', new.ticket_reject_reason));
  end if;
  return new;
end;
$$;

create trigger trips_notify_ticket_reviewed
  after update of ticket_status on public.trips
  for each row when (old.ticket_status is distinct from new.ticket_status)
  execute function public.notify_ticket_reviewed();

-------------------------------------------------------------------------------
-- Push tokens (Expo). A device token belongs to whoever signed in last on it.
-------------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

create policy "Users see their own push tokens"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users remove their own push tokens"
  on public.push_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(p_token text, p_platform text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, (select auth.uid()), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-------------------------------------------------------------------------------
-- Push delivery (service role). Claim before sending: each notification is
-- pushed at most once even if two runs overlap.
-------------------------------------------------------------------------------
create function public.claim_push_batch(p_limit integer default 100)
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
         coalesce(array_agg(t.token) filter (where t.token is not null), '{}')
  from claimed c
  left join public.push_tokens t on t.user_id = c.user_id
  group by c.id, c.user_id, c.kind, c.request_id, c.trip_id, c.params
  order by c.id;
$$;

create function public.forget_push_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = any (p_tokens);
$$;

revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke execute on function public.forget_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
grant execute on function public.forget_push_tokens(text[]) to service_role;

-- Every minute, if there is anything to push, call the Edge Function. The project
-- URL and a shared secret live in Supabase Vault (see docs/NOTIFICATIONS.md);
-- until they are set this does nothing.
create extension if not exists pg_net;

select cron.schedule(
  'send-push-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'notifications_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.notifications where push_claimed_at is null)
    and exists (select 1 from vault.decrypted_secrets where name = 'notifications_cron_secret')
    and exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $$
);

-------------------------------------------------------------------------------
-- Ratings: after settlement, each person rates the other once.
-------------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.item_requests (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (comment = btrim(comment) and char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (request_id, rater_id),
  check (rater_id <> ratee_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id);

alter table public.ratings enable row level security;

revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to authenticated;

-- Reputation is public to signed-in users.
create policy "Signed-in users can read ratings"
  on public.ratings for select
  to authenticated
  using (true);

create function public.rate_counterpart(p_request_id uuid, p_stars integer, p_comment text default '')
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
  -- Spelled out: "not in (a, b)" is unknown, not true, when b is null.
  if (select auth.uid()) is distinct from r.requester_id
    and (select auth.uid()) is distinct from traveler
  then
    raise exception 'Request not found' using errcode = 'HB011';
  end if;
  if r.status <> 'settled' then
    raise exception 'You can rate after the delivery is completed' using errcode = 'HB010';
  end if;

  ratee := case when (select auth.uid()) = r.requester_id then traveler else r.requester_id end;
  insert into public.ratings (request_id, rater_id, ratee_id, stars, comment)
  values (p_request_id, (select auth.uid()), ratee, p_stars, btrim(coalesce(p_comment, '')))
  returning * into rating;

  perform public.notify(ratee, 'rated', p_request_id, null,
                        jsonb_build_object('item', r.item_name, 'stars', p_stars));
  return rating;
end;
$$;

revoke execute on function public.rate_counterpart(uuid, integer, text) from public, anon;
grant execute on function public.rate_counterpart(uuid, integer, text) to authenticated;

/** Average stars (one decimal) and count per person. */
create function public.rating_summary(p_user_ids uuid[])
returns table (user_id uuid, average numeric, count integer)
language sql
stable
set search_path = ''
as $$
  select ratee_id, round(avg(stars), 1), count(*)::integer
  from public.ratings
  where ratee_id = any (p_user_ids)
  group by ratee_id;
$$;

revoke execute on function public.rating_summary(uuid[]) from public, anon;
grant execute on function public.rating_summary(uuid[]) to authenticated;

-------------------------------------------------------------------------------
-- Realtime: chat messages and notifications stream to the app (RLS applies).
-------------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.notifications;
