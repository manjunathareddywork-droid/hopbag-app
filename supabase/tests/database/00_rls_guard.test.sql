-- Guard for the project rule "every table has RLS on, never ship a table without policies".
-- Fails as soon as a migration adds a table in the public schema without RLS or policies.
-- Run with: npm run test:db  (needs Docker and `supabase db start`)
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every public table has row level security enabled'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  $$,
  'every public table has at least one policy'
);

select * from finish();

rollback;
