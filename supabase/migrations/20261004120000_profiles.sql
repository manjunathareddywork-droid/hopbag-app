-- Phase 1: states reference table, user profiles, avatar storage.
--
-- Privacy model: profiles holds only fields any signed-in user may see (name, home
-- city/state, photo). The phone number stays in auth.users and is never exposed here.

-------------------------------------------------------------------------------
-- States and union territories (home state picker). Phase 2 adds cities.
-------------------------------------------------------------------------------
create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null unique
);

alter table public.states enable row level security;

revoke all on public.states from anon, authenticated;
grant select on public.states to anon, authenticated;

create policy "States are readable by everyone"
  on public.states for select
  to anon, authenticated
  using (true);
-- No write policies: reference data changes only through migrations.

insert into public.states (code, name) values
  ('AN', 'Andaman and Nicobar Islands'),
  ('AP', 'Andhra Pradesh'),
  ('AR', 'Arunachal Pradesh'),
  ('AS', 'Assam'),
  ('BR', 'Bihar'),
  ('CH', 'Chandigarh'),
  ('CG', 'Chhattisgarh'),
  ('DH', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('DL', 'Delhi'),
  ('GA', 'Goa'),
  ('GJ', 'Gujarat'),
  ('HR', 'Haryana'),
  ('HP', 'Himachal Pradesh'),
  ('JK', 'Jammu and Kashmir'),
  ('JH', 'Jharkhand'),
  ('KA', 'Karnataka'),
  ('KL', 'Kerala'),
  ('LA', 'Ladakh'),
  ('LD', 'Lakshadweep'),
  ('MP', 'Madhya Pradesh'),
  ('MH', 'Maharashtra'),
  ('MN', 'Manipur'),
  ('ML', 'Meghalaya'),
  ('MZ', 'Mizoram'),
  ('NL', 'Nagaland'),
  ('OD', 'Odisha'),
  ('PY', 'Puducherry'),
  ('PB', 'Punjab'),
  ('RJ', 'Rajasthan'),
  ('SK', 'Sikkim'),
  ('TN', 'Tamil Nadu'),
  ('TS', 'Telangana'),
  ('TR', 'Tripura'),
  ('UP', 'Uttar Pradesh'),
  ('UK', 'Uttarakhand'),
  ('WB', 'West Bengal');

-------------------------------------------------------------------------------
-- Profiles
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (full_name = btrim(full_name) and char_length(full_name) between 2 and 80),
  home_state text not null references public.states (code),
  home_city text not null
    check (home_city = btrim(home_city) and char_length(home_city) between 2 and 60),
  -- Storage path inside the avatars bucket; must be in the user's own folder.
  avatar_path text
    check (avatar_path is null or avatar_path like id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Column privileges: users can never write id (on update), created_at or updated_at.
-- No delete grant: account deletion will be a server-side flow (Phase 8).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name, home_state, home_city, avatar_path) on public.profiles to authenticated;
grant update (full_name, home_state, home_city, avatar_path) on public.profiles to authenticated;

create policy "Signed-in users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-------------------------------------------------------------------------------
-- Avatars bucket: private, signed-in users can view, each user writes only to
-- the folder named after their user id (e.g. <uid>/avatar.jpg).
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Signed-in users can view avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
