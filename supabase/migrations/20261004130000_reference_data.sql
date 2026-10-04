-- Phase 2 reference data: admins, cities, allowed item categories, blocked terms.
-- Reference tables are readable by signed-in users and writable only by admins.

-------------------------------------------------------------------------------
-- Admins. Rows are added by hand (SQL editor) until the admin tools in Phase 3.
-------------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create policy "Users can see whether they are an admin"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- security definer so policies on other tables can check admin status without
-- needing read access to every admins row.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-------------------------------------------------------------------------------
-- Cities. Aliases hold old/alternate names so search finds "Bangalore" too.
-------------------------------------------------------------------------------
create table public.cities (
  id integer generated always as identity primary key,
  state_code text not null references public.states (code),
  name text not null check (name = btrim(name) and char_length(name) between 2 and 60),
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  unique (state_code, name)
);

alter table public.cities enable row level security;

revoke all on public.cities from anon, authenticated;
grant select, insert, update on public.cities to authenticated;

create policy "Signed-in users can read cities"
  on public.cities for select
  to authenticated
  using (true);

create policy "Admins can add cities"
  on public.cities for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit cities"
  on public.cities for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.cities (state_code, name, aliases) values
  ('AN', 'Port Blair', '{Sri Vijaya Puram}'),
  ('AP', 'Visakhapatnam', '{Vizag}'),
  ('AP', 'Vijayawada', '{Bezawada}'),
  ('AP', 'Guntur', '{}'),
  ('AP', 'Nellore', '{}'),
  ('AP', 'Tirupati', '{}'),
  ('AP', 'Kurnool', '{}'),
  ('AP', 'Kakinada', '{}'),
  ('AP', 'Rajahmundry', '{Rajamahendravaram}'),
  ('AP', 'Anantapur', '{Anantapuramu}'),
  ('AP', 'Kadapa', '{Cuddapah}'),
  ('AP', 'Amaravati', '{}'),
  ('AR', 'Itanagar', '{}'),
  ('AS', 'Guwahati', '{Gauhati}'),
  ('AS', 'Dibrugarh', '{}'),
  ('AS', 'Silchar', '{}'),
  ('AS', 'Jorhat', '{}'),
  ('BR', 'Patna', '{}'),
  ('BR', 'Gaya', '{}'),
  ('BR', 'Bhagalpur', '{}'),
  ('BR', 'Muzaffarpur', '{}'),
  ('BR', 'Darbhanga', '{}'),
  ('CH', 'Chandigarh', '{}'),
  ('CG', 'Raipur', '{}'),
  ('CG', 'Bhilai', '{}'),
  ('CG', 'Bilaspur', '{}'),
  ('DH', 'Daman', '{}'),
  ('DH', 'Silvassa', '{}'),
  ('DH', 'Diu', '{}'),
  ('DL', 'Delhi', '{New Delhi}'),
  ('GA', 'Panaji', '{Panjim}'),
  ('GA', 'Margao', '{Madgaon}'),
  ('GA', 'Vasco da Gama', '{Vasco}'),
  ('GJ', 'Ahmedabad', '{Amdavad}'),
  ('GJ', 'Surat', '{}'),
  ('GJ', 'Vadodara', '{Baroda}'),
  ('GJ', 'Rajkot', '{}'),
  ('GJ', 'Bhavnagar', '{}'),
  ('GJ', 'Jamnagar', '{}'),
  ('GJ', 'Gandhinagar', '{}'),
  ('HR', 'Gurugram', '{Gurgaon}'),
  ('HR', 'Faridabad', '{}'),
  ('HR', 'Panipat', '{}'),
  ('HR', 'Ambala', '{}'),
  ('HR', 'Karnal', '{}'),
  ('HR', 'Hisar', '{Hissar}'),
  ('HP', 'Shimla', '{Simla}'),
  ('HP', 'Dharamshala', '{Dharamsala}'),
  ('HP', 'Manali', '{}'),
  ('HP', 'Mandi', '{}'),
  ('JK', 'Srinagar', '{}'),
  ('JK', 'Jammu', '{}'),
  ('JH', 'Ranchi', '{}'),
  ('JH', 'Jamshedpur', '{Tatanagar}'),
  ('JH', 'Dhanbad', '{}'),
  ('JH', 'Bokaro', '{}'),
  ('KA', 'Bengaluru', '{Bangalore}'),
  ('KA', 'Mysuru', '{Mysore}'),
  ('KA', 'Mangaluru', '{Mangalore}'),
  ('KA', 'Hubballi', '{Hubli}'),
  ('KA', 'Dharwad', '{}'),
  ('KA', 'Belagavi', '{Belgaum}'),
  ('KA', 'Kalaburagi', '{Gulbarga}'),
  ('KA', 'Udupi', '{}'),
  ('KA', 'Shivamogga', '{Shimoga}'),
  ('KA', 'Davanagere', '{}'),
  ('KA', 'Ballari', '{Bellary}'),
  ('KL', 'Thiruvananthapuram', '{Trivandrum}'),
  ('KL', 'Kochi', '{Cochin,Ernakulam}'),
  ('KL', 'Kozhikode', '{Calicut}'),
  ('KL', 'Thrissur', '{Trichur}'),
  ('KL', 'Kollam', '{Quilon}'),
  ('KL', 'Kannur', '{Cannanore}'),
  ('KL', 'Alappuzha', '{Alleppey}'),
  ('KL', 'Palakkad', '{Palghat}'),
  ('KL', 'Kottayam', '{}'),
  ('LA', 'Leh', '{}'),
  ('LA', 'Kargil', '{}'),
  ('LD', 'Kavaratti', '{}'),
  ('MP', 'Bhopal', '{}'),
  ('MP', 'Indore', '{}'),
  ('MP', 'Jabalpur', '{}'),
  ('MP', 'Gwalior', '{}'),
  ('MP', 'Ujjain', '{}'),
  ('MH', 'Mumbai', '{Bombay}'),
  ('MH', 'Pune', '{Poona}'),
  ('MH', 'Nagpur', '{}'),
  ('MH', 'Nashik', '{Nasik}'),
  ('MH', 'Chhatrapati Sambhajinagar', '{Aurangabad}'),
  ('MH', 'Thane', '{}'),
  ('MH', 'Navi Mumbai', '{New Bombay}'),
  ('MH', 'Kolhapur', '{}'),
  ('MH', 'Solapur', '{Sholapur}'),
  ('MH', 'Amravati', '{}'),
  ('MN', 'Imphal', '{}'),
  ('ML', 'Shillong', '{}'),
  ('MZ', 'Aizawl', '{}'),
  ('NL', 'Kohima', '{}'),
  ('NL', 'Dimapur', '{}'),
  ('OD', 'Bhubaneswar', '{}'),
  ('OD', 'Cuttack', '{}'),
  ('OD', 'Rourkela', '{}'),
  ('OD', 'Puri', '{}'),
  ('OD', 'Sambalpur', '{}'),
  ('PY', 'Puducherry', '{Pondicherry,Pondy}'),
  ('PB', 'Ludhiana', '{}'),
  ('PB', 'Amritsar', '{}'),
  ('PB', 'Jalandhar', '{Jullundur}'),
  ('PB', 'Patiala', '{}'),
  ('PB', 'Mohali', '{SAS Nagar}'),
  ('RJ', 'Jaipur', '{}'),
  ('RJ', 'Jodhpur', '{}'),
  ('RJ', 'Udaipur', '{}'),
  ('RJ', 'Kota', '{}'),
  ('RJ', 'Ajmer', '{}'),
  ('RJ', 'Bikaner', '{}'),
  ('SK', 'Gangtok', '{}'),
  ('TN', 'Chennai', '{Madras}'),
  ('TN', 'Coimbatore', '{Kovai}'),
  ('TN', 'Madurai', '{}'),
  ('TN', 'Tiruchirappalli', '{Trichy}'),
  ('TN', 'Salem', '{}'),
  ('TN', 'Tirunelveli', '{}'),
  ('TN', 'Vellore', '{}'),
  ('TN', 'Erode', '{}'),
  ('TN', 'Thoothukudi', '{Tuticorin}'),
  ('TN', 'Hosur', '{}'),
  ('TS', 'Hyderabad', '{Secunderabad}'),
  ('TS', 'Warangal', '{}'),
  ('TS', 'Karimnagar', '{}'),
  ('TS', 'Nizamabad', '{}'),
  ('TS', 'Khammam', '{}'),
  ('TR', 'Agartala', '{}'),
  ('UP', 'Lucknow', '{}'),
  ('UP', 'Kanpur', '{Cawnpore}'),
  ('UP', 'Varanasi', '{Banaras,Benares,Kashi}'),
  ('UP', 'Agra', '{}'),
  ('UP', 'Prayagraj', '{Allahabad}'),
  ('UP', 'Noida', '{}'),
  ('UP', 'Ghaziabad', '{}'),
  ('UP', 'Meerut', '{}'),
  ('UP', 'Gorakhpur', '{}'),
  ('UP', 'Bareilly', '{}'),
  ('UP', 'Aligarh', '{}'),
  ('UP', 'Mathura', '{}'),
  ('UK', 'Dehradun', '{}'),
  ('UK', 'Haridwar', '{Hardwar}'),
  ('UK', 'Rishikesh', '{}'),
  ('UK', 'Haldwani', '{}'),
  ('UK', 'Nainital', '{}'),
  ('WB', 'Kolkata', '{Calcutta}'),
  ('WB', 'Howrah', '{}'),
  ('WB', 'Siliguri', '{}'),
  ('WB', 'Durgapur', '{}'),
  ('WB', 'Asansol', '{}');

-------------------------------------------------------------------------------
-- Allowed item categories (the allowlist). Requests must use an active one.
-- name/description are English fallbacks; the app shows translated text by id.
-- Deactivate instead of deleting so existing requests keep their category.
-------------------------------------------------------------------------------
create table public.allowed_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  max_weight_grams integer not null check (max_weight_grams between 50 and 5000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger allowed_categories_set_updated_at
  before update on public.allowed_categories
  for each row execute function public.set_updated_at();

alter table public.allowed_categories enable row level security;

revoke all on public.allowed_categories from anon, authenticated;
grant select on public.allowed_categories to authenticated;
grant insert (id, name, description, max_weight_grams, is_active, sort_order)
  on public.allowed_categories to authenticated;
grant update (name, description, max_weight_grams, is_active, sort_order)
  on public.allowed_categories to authenticated;

create policy "Signed-in users can read categories"
  on public.allowed_categories for select
  to authenticated
  using (true);

create policy "Admins can add categories"
  on public.allowed_categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit categories"
  on public.allowed_categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Starter list: everyday goods that are legal to carry between states by train,
-- bus or plane and that a traveler can open and inspect. Max 5 kg per item
-- (the per-trip cap); smaller limits where liquids/fragility make sense.
insert into public.allowed_categories (id, name, description, max_weight_grams, sort_order) values
  ('coffee_tea', 'Coffee and tea', 'Coffee powder, beans, tea leaves.', 3000, 10),
  ('spices', 'Spices and masalas', 'Whole or ground spices, masala powders.', 3000, 20),
  ('sweets_snacks', 'Sweets and snacks', 'Shop-packed sweets, namkeen, savouries, biscuits.', 3000, 30),
  ('pickles', 'Pickles and preserves', 'Pickles, podis, jams in leak-proof containers.', 2000, 40),
  ('chocolates', 'Chocolates', 'Chocolates and confectionery.', 2000, 50),
  ('dry_fruits', 'Dry fruits and nuts', 'Cashews, almonds, raisins, dates.', 3000, 60),
  ('books', 'Books and stationery', 'Books, notebooks, pens, art supplies.', 5000, 70),
  ('clothes', 'Clothes and textiles', 'Sarees, dress materials, clothes, shawls.', 5000, 80),
  ('handicrafts', 'Handicrafts and decor', 'Small handicrafts, wooden toys, decor items.', 3000, 90),
  ('cosmetics', 'Cosmetics and personal care', 'Creams, soaps, small bottles. No sprays or aerosols.', 1000, 100),
  ('toys', 'Toys and games', 'Toys and board games without batteries.', 3000, 110);

-------------------------------------------------------------------------------
-- Blocked terms: never-allowed items (PRODUCT.md rule 2). Checked against the
-- item name and details. `pattern` is matched as whole words, case-insensitive;
-- keep it to syntax both Postgres and JavaScript regex understand: letters,
-- spaces, ?, |, ( ).
-------------------------------------------------------------------------------
create table public.blocked_terms (
  id integer generated always as identity primary key,
  pattern text not null unique check (pattern ~ '^[a-z ?|()]+$'),
  reason_code text not null check (reason_code in (
    'medicine', 'alcohol', 'tobacco', 'valuables', 'batteries',
    'weapons', 'flammable', 'drugs', 'animals'
  ))
);

alter table public.blocked_terms enable row level security;

revoke all on public.blocked_terms from anon, authenticated;
grant select, insert, update, delete on public.blocked_terms to authenticated;

create policy "Signed-in users can read blocked terms"
  on public.blocked_terms for select
  to authenticated
  using (true);

create policy "Admins can add blocked terms"
  on public.blocked_terms for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit blocked terms"
  on public.blocked_terms for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can remove blocked terms"
  on public.blocked_terms for delete
  to authenticated
  using ((select public.is_admin()));

insert into public.blocked_terms (pattern, reason_code) values
  ('medicines?', 'medicine'),
  ('medications?', 'medicine'),
  ('tablets?', 'medicine'),
  ('capsules?', 'medicine'),
  ('pills?', 'medicine'),
  ('injections?', 'medicine'),
  ('syringes?', 'medicine'),
  ('ayurvedic medicines?', 'medicine'),
  ('cough syrups?', 'medicine'),
  ('alcohol', 'alcohol'),
  ('liquor', 'alcohol'),
  ('whiske?y', 'alcohol'),
  ('vodka', 'alcohol'),
  ('rum', 'alcohol'),
  ('gin', 'alcohol'),
  ('brandy', 'alcohol'),
  ('beers?', 'alcohol'),
  ('wines?', 'alcohol'),
  ('feni', 'alcohol'),
  ('toddy', 'alcohol'),
  ('tobacco', 'tobacco'),
  ('cigarettes?', 'tobacco'),
  ('cigars?', 'tobacco'),
  ('(beedi|bidi)s?', 'tobacco'),
  ('gutkh?a', 'tobacco'),
  ('pan masala', 'tobacco'),
  ('khaini', 'tobacco'),
  ('vapes?', 'tobacco'),
  ('cash', 'valuables'),
  ('currency', 'valuables'),
  -- Not plain "gold"/"silver": that would block Nescafe Gold or sweets with silver varq.
  ('(gold|silver) (coins?|chains?|bars?|biscuits?|rings?|bangles?|ornaments?|jewell?e?ry)', 'valuables'),
  ('jewell?e?ry', 'valuables'),
  ('diamonds?', 'valuables'),
  ('batter(y|ies)', 'batteries'),
  ('power ?banks?', 'batteries'),
  ('lithium', 'batteries'),
  ('(knife|knives)', 'weapons'),
  ('guns?', 'weapons'),
  ('swords?', 'weapons'),
  ('ammunition', 'weapons'),
  ('fire ?crackers?', 'flammable'),
  ('fireworks?', 'flammable'),
  ('petrol|diesel|kerosene', 'flammable'),
  ('gas cylinders?', 'flammable'),
  ('aerosols?', 'flammable'),
  ('lighters?', 'flammable'),
  ('acids?', 'flammable'),
  ('drugs?', 'drugs'),
  ('ganja|marijuana|cannabis|charas|hashish', 'drugs'),
  ('live (animals?|birds?|fish|pets?)', 'animals'),
  ('puppy|puppies|kittens?', 'animals');
