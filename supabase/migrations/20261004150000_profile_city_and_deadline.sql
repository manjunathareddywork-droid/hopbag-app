-- Profiles pick their home city from the cities list (instead of free text), and
-- request deadlines are capped at 20 days.

insert into public.cities (state_code, name, aliases) values ('AP', 'Proddatur', '{}');

-------------------------------------------------------------------------------
-- profiles.home_city (text) -> profiles.home_city_id. home_state is now derived
-- from the city and is no longer client-writable.
-------------------------------------------------------------------------------
alter table public.profiles add column home_city_id integer references public.cities (id);

-- Carry over existing profiles whose city text matches a listed city or alias.
update public.profiles p
set home_city_id = c.id
from public.cities c
where c.state_code = p.home_state
  and (
    lower(c.name) = lower(p.home_city)
    or lower(p.home_city) = any (select lower(a) from unnest(c.aliases) as a)
  );

-- NOT VALID: older profiles without a match keep working until edited; the app
-- asks those users to choose their city. Every new insert/update must have one.
alter table public.profiles
  add constraint profiles_home_city_required check (home_city_id is not null) not valid;

alter table public.profiles drop column home_city;

create function public.profiles_set_home_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.home_city_id is not null then
    select state_code into new.home_state from public.cities where id = new.home_city_id;
    if not found then
      raise exception 'Unknown city %', new.home_city_id using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_set_home_state
  before insert or update of home_city_id on public.profiles
  for each row execute function public.profiles_set_home_state();

revoke insert (home_state), update (home_state) on public.profiles from authenticated;
grant insert (home_city_id), update (home_city_id) on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Request deadline: tomorrow to 20 days (was 90). Same function as before with
-- the new limit; existing requests are only re-checked if their content changes.
-------------------------------------------------------------------------------
create or replace function public.item_requests_validate()
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

  if new.deadline < public.today_ist() + 1 or new.deadline > public.today_ist() + 20 then
    raise exception 'Deadline must be between tomorrow and 20 days from today'
      using errcode = 'HB005';
  end if;

  return new;
end;
$$;
