-- Core schema: PostGIS, entities, check-ins
-- See docs/PRODUCT.md for product defaults (US, public check-ins, 0.5–5.0 stars).

create extension if not exists postgis;

-- Updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  region_code text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  region_code text not null default 'US',
  hq_location geography (point, 4326),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_code, slug)
);

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  region_code text not null default 'US',
  location geography (point, 4326) not null,
  address_json jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_code, slug)
);

create table public.coffees (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid not null references public.roasters (id) on delete restrict,
  name text not null,
  slug text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roaster_id, slug)
);

create table public.cafe_roaster (
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  roaster_id uuid not null references public.roasters (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (cafe_id, roaster_id)
);

create table public.brew_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  coffee_id uuid not null references public.coffees (id) on delete restrict,
  cafe_id uuid references public.cafes (id) on delete set null,
  context text not null,
  brew_method_id uuid not null references public.brew_methods (id) on delete restrict,
  rating numeric(2, 1) not null,
  notes text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint check_ins_context_chk check (context in ('home', 'cafe')),
  constraint check_ins_cafe_context_chk check (
    (context = 'cafe' and cafe_id is not null)
    or (context = 'home' and cafe_id is null)
  ),
  constraint check_ins_rating_range_chk check (rating >= 0.5 and rating <= 5.0),
  constraint check_ins_half_step_chk check ((rating * 2) = round(rating * 2)),
  constraint check_ins_visibility_chk check (visibility in ('public', 'private'))
);

create table public.check_in_tags (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  primary key (check_in_id, tag_id)
);

create index check_ins_user_created_idx on public.check_ins (user_id, created_at desc);
create index check_ins_coffee_idx on public.check_ins (coffee_id);
create index check_ins_cafe_idx on public.check_ins (cafe_id) where cafe_id is not null;
create index cafes_location_gix on public.cafes using gist (location);
create index roasters_hq_gix on public.roasters using gist (hq_location) where hq_location is not null;
create index roasters_region_idx on public.roasters (region_code);
create index cafes_region_idx on public.cafes (region_code);
create index coffees_roaster_idx on public.coffees (roaster_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_roasters_updated_at
before update on public.roasters
for each row execute function public.set_updated_at();

create trigger set_cafes_updated_at
before update on public.cafes
for each row execute function public.set_updated_at();

create trigger set_coffees_updated_at
before update on public.coffees
for each row execute function public.set_updated_at();

-- New auth user -> profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

comment on table public.check_ins is 'User coffee check-in; see docs/PRODUCT.md for visibility and rating.';
