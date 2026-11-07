-- rate coffee v2 schema. Fresh start; the v1 MVP is tagged legacy-mvp in git.
-- Catalog (roasters, coffees, cafes) is public-readable and partly ingested by
-- scripts running with the service role. Check-ins are user-owned.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- trim, lowercase, collapse whitespace. Used for dedup keys.
create or replace function public.normalize_name(v text)
returns text language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(v, '')), '\s+', ' ', 'g'))
$$;

-- URL slug from a display name. Callers add a suffix on collision.
create or replace function public.slugify(v text)
returns text language sql immutable as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(unaccent(coalesce(v, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ),
    'item'
  )
$$;

-- Shrinks small-sample averages toward a prior so one 5-star check-in
-- does not outrank fifty 4.6s.
create or replace function public.bayesian_rating(
  avg_rating numeric, n bigint, prior_mean numeric default 3.5, prior_weight int default 5
) returns numeric language sql immutable as $$
  select case
    when n is null or n = 0 or avg_rating is null then null
    else round(((avg_rating * n) + (prior_mean * prior_weight)) / (n + prior_weight), 2)
  end
$$;

-- ---------------------------------------------------------------- enums

create type public.roast_level as enum
  ('ultra_light', 'light', 'medium_light', 'medium', 'medium_dark', 'dark');
create type public.process_family as enum
  ('washed', 'natural', 'honey', 'anaerobic', 'experimental', 'other');
create type public.process_focus as enum ('washed', 'mixed', 'experimental');
create type public.entity_status as enum ('active', 'closed', 'unknown');
create type public.link_relationship as enum ('serves', 'primary', 'rotating', 'retail', 'owns');
create type public.data_source as enum
  ('manual', 'import', 'roaster_site', 'shopify', 'cafe_site', 'instagram', 'google_places', 'osm', 'user_checkin');
create type public.visibility as enum ('public', 'private');
create type public.brew_category as enum ('espresso', 'milk', 'filter', 'immersion', 'cold', 'other');

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'curator', 'admin')),
  home_city text,
  home_location geography (point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'curator')
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist in auth (the v1 account).
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, ''), '@', 1)),
       u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------- roasters

create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  normalized_name text generated always as (public.normalize_name(name)) stored,
  website text,
  shop_url text,
  instagram text,
  description text,
  logo_url text,
  city text,
  region text,
  country_code text not null default 'US' check (char_length(country_code) = 2),
  hq_location geography (point, 4326),
  -- Derived from the current menu by ingestion, or set by a curator.
  roast_level public.roast_level,
  process_focus public.process_focus,
  single_origin_share numeric(3, 2) check (single_origin_share between 0 and 1),
  curation_tier smallint not null default 0 check (curation_tier between 0 and 3),
  status public.entity_status not null default 'active',
  is_verified boolean not null default false,
  source public.data_source not null default 'manual',
  source_url text,
  attributes_updated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index roasters_country_normalized_name_uidx on public.roasters (country_code, normalized_name);
create index roasters_hq_gix on public.roasters using gist (hq_location);
create index roasters_name_trgm_idx on public.roasters using gin (normalized_name gin_trgm_ops);
create index roasters_city_idx on public.roasters (country_code, region, city);

create trigger roasters_updated_at before update on public.roasters
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- coffees

create table public.coffees (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid not null references public.roasters (id) on delete cascade,
  slug text not null,
  name text not null,
  normalized_name text generated always as (public.normalize_name(name)) stored,
  is_blend boolean not null default false,
  roast_level public.roast_level,
  origin_country_code text check (origin_country_code is null or char_length(origin_country_code) = 2),
  origin_region text,
  producer text,
  farm text,
  varieties text[] not null default '{}',
  process text,
  process_family public.process_family,
  tasting_notes text[] not null default '{}',
  elevation_m int,
  price_cents int,
  size_grams int,
  url text,
  image_url text,
  status public.entity_status not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source public.data_source not null default 'manual',
  external_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roaster_id, slug),
  unique (roaster_id, normalized_name)
);

create unique index coffees_roaster_external_uidx
  on public.coffees (roaster_id, source, external_id) where external_id is not null;
create index coffees_roaster_idx on public.coffees (roaster_id, status);
create index coffees_name_trgm_idx on public.coffees using gin (normalized_name gin_trgm_ops);

create trigger coffees_updated_at before update on public.coffees
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- cafes

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  normalized_name text generated always as (public.normalize_name(name)) stored,
  location geography (point, 4326) not null,
  address_line1 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US' check (char_length(country_code) = 2),
  website text,
  instagram text,
  phone text,
  hours jsonb,
  google_place_id text unique,
  osm_id text,
  -- Set when the cafe is a roaster's own shop.
  roaster_id uuid references public.roasters (id) on delete set null,
  has_espresso boolean,
  has_pourover boolean,
  has_batch_brew boolean,
  is_multi_roaster boolean,
  curation_tier smallint not null default 0 check (curation_tier between 0 and 3),
  status public.entity_status not null default 'active',
  is_verified boolean not null default false,
  source public.data_source not null default 'manual',
  source_url text,
  attributes_updated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cafes_location_gix on public.cafes using gist (location);
create index cafes_name_trgm_idx on public.cafes using gin (normalized_name gin_trgm_ops);
create index cafes_city_idx on public.cafes (country_code, region, city);
create index cafes_roaster_idx on public.cafes (roaster_id) where roaster_id is not null;

create trigger cafes_updated_at before update on public.cafes
for each row execute function public.set_updated_at();

-- Which roasters a cafe serves. The core "is this a specialty cafe" signal.
create table public.cafe_roasters (
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  roaster_id uuid not null references public.roasters (id) on delete cascade,
  relationship public.link_relationship not null default 'serves',
  source public.data_source not null default 'manual',
  source_url text,
  confidence numeric(3, 2) not null default 1 check (confidence between 0 and 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (cafe_id, roaster_id)
);

create index cafe_roasters_roaster_idx on public.cafe_roasters (roaster_id);

-- ---------------------------------------------------------------- reference data

create table public.brew_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category public.brew_category not null,
  sort_order int not null default 0
);

insert into public.brew_methods (slug, label, category, sort_order) values
  ('espresso', 'Espresso', 'espresso', 10),
  ('americano', 'Americano', 'espresso', 20),
  ('cortado', 'Cortado / macchiato', 'milk', 30),
  ('flat-white', 'Flat white', 'milk', 40),
  ('cappuccino', 'Cappuccino', 'milk', 50),
  ('latte', 'Latte', 'milk', 60),
  ('pour-over', 'Pour over', 'filter', 70),
  ('batch-brew', 'Batch brew / drip', 'filter', 80),
  ('aeropress', 'AeroPress', 'immersion', 90),
  ('french-press', 'French press', 'immersion', 100),
  ('cold-brew', 'Cold brew', 'cold', 110),
  ('iced-filter', 'Iced / flash-brew filter', 'cold', 120),
  ('moka-pot', 'Moka pot', 'other', 130),
  ('other', 'Other', 'other', 999);

create table public.flavor_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  family text not null,
  sort_order int not null default 0
);

insert into public.flavor_tags (slug, label, family, sort_order) values
  ('berry', 'Berry', 'fruit', 10),
  ('stone-fruit', 'Stone fruit', 'fruit', 20),
  ('citrus', 'Citrus', 'fruit', 30),
  ('tropical', 'Tropical', 'fruit', 40),
  ('dried-fruit', 'Dried fruit', 'fruit', 50),
  ('floral', 'Floral', 'floral', 60),
  ('tea-like', 'Tea-like', 'floral', 70),
  ('chocolate', 'Chocolate', 'sweet', 80),
  ('caramel', 'Caramel', 'sweet', 90),
  ('brown-sugar', 'Brown sugar', 'sweet', 100),
  ('honey', 'Honey', 'sweet', 110),
  ('nutty', 'Nutty', 'nutty', 120),
  ('winey', 'Winey', 'fermented', 130),
  ('boozy', 'Boozy', 'fermented', 140),
  ('funky', 'Funky', 'fermented', 150),
  ('juicy', 'Juicy', 'acidity', 160),
  ('bright', 'Bright', 'acidity', 170),
  ('clean', 'Clean', 'structure', 180),
  ('balanced', 'Balanced', 'structure', 190),
  ('syrupy', 'Syrupy', 'body', 200),
  ('heavy-body', 'Heavy body', 'body', 210),
  ('roasty', 'Roasty', 'roast', 220),
  ('smoky', 'Smoky', 'roast', 230),
  ('earthy', 'Earthy', 'other', 240),
  ('spicy', 'Spicy', 'other', 250);

-- ---------------------------------------------------------------- check-ins

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  coffee_id uuid references public.coffees (id) on delete set null,
  -- Denormalized from coffee when present; set directly when the coffee is unknown.
  roaster_id uuid references public.roasters (id) on delete set null,
  cafe_id uuid references public.cafes (id) on delete set null,
  brew_method_id uuid references public.brew_methods (id) on delete set null,
  rating numeric(2, 1) not null,
  notes text,
  photo_url text,
  visibility public.visibility not null default 'public',
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_ins_rating_range_chk check (rating >= 0.5 and rating <= 5.0),
  constraint check_ins_half_step_chk check ((rating * 2) = round(rating * 2)),
  constraint check_ins_notes_len_chk check (notes is null or char_length(notes) <= 5000),
  constraint check_ins_subject_chk check (coffee_id is not null or roaster_id is not null or cafe_id is not null)
);

create index check_ins_user_idx on public.check_ins (user_id, consumed_at desc);
create index check_ins_coffee_idx on public.check_ins (coffee_id) where coffee_id is not null;
create index check_ins_roaster_idx on public.check_ins (roaster_id) where roaster_id is not null;
create index check_ins_cafe_idx on public.check_ins (cafe_id) where cafe_id is not null;
create index check_ins_public_recent_idx on public.check_ins (consumed_at desc) where visibility = 'public';

create or replace function public.check_ins_fill_roaster()
returns trigger language plpgsql as $$
begin
  if new.coffee_id is not null then
    select c.roaster_id into new.roaster_id from public.coffees c where c.id = new.coffee_id;
  end if;
  return new;
end $$;

create trigger check_ins_fill_roaster before insert or update of coffee_id on public.check_ins
for each row execute function public.check_ins_fill_roaster();

create trigger check_ins_updated_at before update on public.check_ins
for each row execute function public.set_updated_at();

create table public.check_in_tags (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  tag_id uuid not null references public.flavor_tags (id) on delete cascade,
  primary key (check_in_id, tag_id)
);

-- ---------------------------------------------------------------- stats views

create view public.coffee_stats with (security_invoker = on) as
select
  co.id as coffee_id,
  count(ci.id) as check_in_count,
  avg(ci.rating) as avg_rating,
  public.bayesian_rating(avg(ci.rating), count(ci.id)) as score
from public.coffees co
left join public.check_ins ci on ci.coffee_id = co.id and ci.visibility = 'public'
group by co.id;

create view public.roaster_stats with (security_invoker = on) as
select
  r.id as roaster_id,
  (select count(*) from public.coffees c where c.roaster_id = r.id and c.status = 'active') as active_coffee_count,
  count(ci.id) as check_in_count,
  avg(ci.rating) as avg_rating,
  public.bayesian_rating(avg(ci.rating), count(ci.id)) as score
from public.roasters r
left join public.check_ins ci on ci.roaster_id = r.id and ci.visibility = 'public'
group by r.id;

create view public.cafe_stats with (security_invoker = on) as
select
  c.id as cafe_id,
  (select count(*) from public.cafe_roasters cr where cr.cafe_id = c.id) as roaster_count,
  (select max(rs.score) from public.cafe_roasters cr join public.roaster_stats rs on rs.roaster_id = cr.roaster_id where cr.cafe_id = c.id) as best_roaster_score,
  count(ci.id) as check_in_count,
  avg(ci.rating) as avg_rating,
  public.bayesian_rating(avg(ci.rating), count(ci.id)) as score
from public.cafes c
left join public.check_ins ci on ci.cafe_id = c.id and ci.visibility = 'public'
group by c.id;

-- ---------------------------------------------------------------- discovery RPCs

create or replace function public.nearby_cafes(
  lat double precision, lng double precision,
  radius_m double precision default 25000, lim int default 100
) returns table (
  id uuid, slug text, name text, city text,
  lat double precision, lng double precision, distance_m double precision,
  curation_tier smallint, roaster_count bigint
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g)
  select
    c.id, c.slug, c.name, c.city,
    st_y(c.location::geometry), st_x(c.location::geometry),
    st_distance(c.location, o.g),
    c.curation_tier,
    (select count(*) from public.cafe_roasters cr where cr.cafe_id = c.id)
  from public.cafes c, origin o
  where c.status <> 'closed' and st_dwithin(c.location, o.g, radius_m)
  order by st_distance(c.location, o.g)
  limit lim
$$;

create or replace function public.nearby_roasters(
  lat double precision, lng double precision,
  radius_m double precision default 50000, lim int default 100
) returns table (
  id uuid, slug text, name text, city text,
  lat double precision, lng double precision, distance_m double precision,
  roast_level public.roast_level, process_focus public.process_focus, curation_tier smallint
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g)
  select
    r.id, r.slug, r.name, r.city,
    st_y(r.hq_location::geometry), st_x(r.hq_location::geometry),
    st_distance(r.hq_location, o.g),
    r.roast_level, r.process_focus, r.curation_tier
  from public.roasters r, origin o
  where r.status <> 'closed' and r.hq_location is not null and st_dwithin(r.hq_location, o.g, radius_m)
  order by st_distance(r.hq_location, o.g)
  limit lim
$$;

create or replace function public.search_catalog(q text, lim int default 20)
returns table (kind text, id uuid, slug text, name text, subtitle text, rank real)
language sql stable as $$
  with nq as (select public.normalize_name(q) as n)
  select * from (
    select 'roaster'::text as kind, r.id, r.slug, r.name, coalesce(r.city, '') as subtitle, similarity(r.normalized_name, nq.n) as rank
    from public.roasters r, nq
    where r.normalized_name % nq.n or r.normalized_name like nq.n || '%'
    union all
    select 'cafe', c.id, c.slug, c.name, coalesce(c.city, ''), similarity(c.normalized_name, nq.n)
    from public.cafes c, nq
    where c.normalized_name % nq.n or c.normalized_name like nq.n || '%'
    union all
    select 'coffee', co.id, co.slug, co.name, r.name, similarity(co.normalized_name, nq.n)
    from public.coffees co join public.roasters r on r.id = co.roaster_id, nq
    where co.normalized_name % nq.n or co.normalized_name like nq.n || '%'
  ) s
  order by rank desc, name
  limit lim
$$;

-- ---------------------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.roasters enable row level security;
alter table public.coffees enable row level security;
alter table public.cafes enable row level security;
alter table public.cafe_roasters enable row level security;
alter table public.brew_methods enable row level security;
alter table public.flavor_tags enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_tags enable row level security;

create policy "profiles: public read" on public.profiles for select using (true);
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

create policy "brew_methods: public read" on public.brew_methods for select using (true);
create policy "flavor_tags: public read" on public.flavor_tags for select using (true);

-- Catalog: anyone reads; signed-in users add; owners or curators edit; curators delete.
create policy "roasters: public read" on public.roasters for select using (true);
create policy "roasters: authed insert" on public.roasters for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "roasters: owner or admin update" on public.roasters for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());
create policy "roasters: admin delete" on public.roasters for delete to authenticated
  using (public.is_admin());

create policy "coffees: public read" on public.coffees for select using (true);
create policy "coffees: authed insert" on public.coffees for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "coffees: owner or admin update" on public.coffees for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());
create policy "coffees: admin delete" on public.coffees for delete to authenticated
  using (public.is_admin());

create policy "cafes: public read" on public.cafes for select using (true);
create policy "cafes: authed insert" on public.cafes for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "cafes: owner or admin update" on public.cafes for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());
create policy "cafes: admin delete" on public.cafes for delete to authenticated
  using (public.is_admin());

create policy "cafe_roasters: public read" on public.cafe_roasters for select using (true);
create policy "cafe_roasters: authed insert" on public.cafe_roasters for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "cafe_roasters: owner or admin update" on public.cafe_roasters for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());
create policy "cafe_roasters: owner or admin delete" on public.cafe_roasters for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());

create policy "check_ins: read public or own" on public.check_ins for select
  using (visibility = 'public' or user_id = (select auth.uid()));
create policy "check_ins: insert own" on public.check_ins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "check_ins: update own" on public.check_ins for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "check_ins: delete own" on public.check_ins for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "check_in_tags: read via parent" on public.check_in_tags for select
  using (exists (
    select 1 from public.check_ins c
    where c.id = check_in_tags.check_in_id
      and (c.visibility = 'public' or c.user_id = (select auth.uid()))
  ));
create policy "check_in_tags: write own" on public.check_in_tags for all to authenticated
  using (exists (select 1 from public.check_ins c where c.id = check_in_tags.check_in_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.check_ins c where c.id = check_in_tags.check_in_id and c.user_id = (select auth.uid())));

-- ---------------------------------------------------------------- grants

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.roasters, public.coffees, public.cafes, public.cafe_roasters,
  public.check_ins, public.check_in_tags to authenticated;
grant update on public.profiles to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
