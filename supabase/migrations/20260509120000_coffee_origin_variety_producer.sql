-- Coffee catalog: origins (countries), varieties (varietals), producers (per origin)

create table public.coffee_origins (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order int not null default 0
);

create table public.coffee_varieties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0
);

create table public.coffee_producers (
  id uuid primary key default gen_random_uuid(),
  origin_id uuid not null references public.coffee_origins (id) on delete restrict,
  name text not null,
  normalized_name text generated always as (public.normalize_entity_name(name)) stored,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origin_id, normalized_name)
);

create index coffee_producers_origin_idx on public.coffee_producers (origin_id);

create trigger set_coffee_producers_updated_at
before update on public.coffee_producers
for each row execute function public.set_updated_at();

alter table public.coffees
  add column if not exists origin_id uuid references public.coffee_origins (id) on delete restrict;

alter table public.coffees
  add column if not exists variety_id uuid references public.coffee_varieties (id) on delete restrict;

alter table public.coffees
  add column if not exists producer_id uuid references public.coffee_producers (id) on delete restrict;

create index if not exists coffees_origin_idx on public.coffees (origin_id);
create index if not exists coffees_variety_idx on public.coffees (variety_id);
create index if not exists coffees_producer_idx on public.coffees (producer_id);

-- Seed origins (major coffee-producing countries / regions)
insert into public.coffee_origins (code, label, sort_order) values
  ('AO', 'Angola', 10),
  ('AU', 'Australia', 20),
  ('BO', 'Bolivia', 30),
  ('BR', 'Brazil', 40),
  ('BI', 'Burundi', 50),
  ('CM', 'Cameroon', 60),
  ('CF', 'Central African Republic', 70),
  ('CN', 'China', 80),
  ('CO', 'Colombia', 90),
  ('CR', 'Costa Rica', 100),
  ('CD', 'Democratic Republic of the Congo', 110),
  ('DO', 'Dominican Republic', 120),
  ('EC', 'Ecuador', 130),
  ('SV', 'El Salvador', 140),
  ('GQ', 'Equatorial Guinea', 150),
  ('ET', 'Ethiopia', 160),
  ('GA', 'Gabon', 170),
  ('GH', 'Ghana', 180),
  ('GT', 'Guatemala', 190),
  ('GN', 'Guinea', 200),
  ('HT', 'Haiti', 210),
  ('HN', 'Honduras', 220),
  ('IN', 'India', 230),
  ('ID', 'Indonesia', 240),
  ('CI', 'Ivory Coast', 250),
  ('JM', 'Jamaica', 260),
  ('KE', 'Kenya', 270),
  ('LA', 'Laos', 280),
  ('MG', 'Madagascar', 290),
  ('MW', 'Malawi', 300),
  ('MX', 'Mexico', 310),
  ('MM', 'Myanmar', 320),
  ('NI', 'Nicaragua', 330),
  ('PG', 'Papua New Guinea', 340),
  ('PY', 'Paraguay', 350),
  ('PE', 'Peru', 360),
  ('PH', 'Philippines', 370),
  ('PR', 'Puerto Rico', 380),
  ('RW', 'Rwanda', 390),
  ('ST', 'São Tomé and Príncipe', 400),
  ('SN', 'Senegal', 410),
  ('SL', 'Sierra Leone', 420),
  ('ZA', 'South Africa', 430),
  ('LK', 'Sri Lanka', 440),
  ('TZ', 'Tanzania', 450),
  ('TH', 'Thailand', 460),
  ('TL', 'Timor-Leste', 470),
  ('TG', 'Togo', 480),
  ('TT', 'Trinidad and Tobago', 490),
  ('UG', 'Uganda', 500),
  ('US-HI', 'United States (Hawaii)', 510),
  ('VN', 'Vietnam', 520),
  ('YE', 'Yemen', 530),
  ('ZM', 'Zambia', 540),
  ('ZW', 'Zimbabwe', 550);

insert into public.coffee_varieties (slug, label, sort_order) values
  ('batian', 'Batian', 10),
  ('bourbon', 'Bourbon', 20),
  ('catimor', 'Catimor', 30),
  ('catuai', 'Catuai', 40),
  ('caturra', 'Caturra', 50),
  ('gesha', 'Gesha', 60),
  ('heirloom', 'Heirloom', 70),
  ('java', 'Java', 80),
  ('kp423', 'KP423', 90),
  ('maragogipe', 'Maragogipe', 100),
  ('mundo-novo', 'Mundo Novo', 110),
  ('pacamara', 'Pacamara', 120),
  ('pink-bourbon', 'Pink Bourbon', 130),
  ('ruiru-11', 'Ruiru 11', 140),
  ('sl14', 'SL14', 150),
  ('sl28', 'SL28', 160),
  ('sl34', 'SL34', 170),
  ('tim-tim', 'Tim Tim', 180),
  ('typica', 'Typica', 190),
  ('villalobos', 'Villalobos', 200),
  ('yellow-bourbon', 'Yellow Bourbon', 210);

alter table public.coffee_origins enable row level security;
alter table public.coffee_varieties enable row level security;
alter table public.coffee_producers enable row level security;

create policy "Anyone read coffee_origins" on public.coffee_origins
  for select using (true);

create policy "Anyone read coffee_varieties" on public.coffee_varieties
  for select using (true);

create policy "Anyone read coffee_producers" on public.coffee_producers
  for select using (true);

create policy "Authed create coffee_producer" on public.coffee_producers
  for insert to authenticated
  with check (created_by is not null and created_by = (select auth.uid()));

grant select on public.coffee_origins to anon, authenticated;
grant select on public.coffee_varieties to anon, authenticated;
grant select on public.coffee_producers to anon, authenticated;
grant insert on public.coffee_producers to authenticated;
