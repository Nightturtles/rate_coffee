-- Catalog quality + lightweight client observability

create or replace function public.normalize_entity_name(v text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(v, '')), '\s+', ' ', 'g'));
$$;

alter table public.roasters
  add column if not exists normalized_name text generated always as (public.normalize_entity_name(name)) stored,
  add column if not exists is_verified boolean not null default false;

alter table public.cafes
  add column if not exists normalized_name text generated always as (public.normalize_entity_name(name)) stored,
  add column if not exists is_verified boolean not null default false;

alter table public.coffees
  add column if not exists normalized_name text generated always as (public.normalize_entity_name(name)) stored,
  add column if not exists is_verified boolean not null default false;

create unique index if not exists roasters_region_normalized_name_uidx
  on public.roasters (region_code, normalized_name);

create index if not exists cafes_region_normalized_name_idx
  on public.cafes (region_code, normalized_name);

create unique index if not exists coffees_roaster_normalized_name_uidx
  on public.coffees (roaster_id, normalized_name);

-- Re-define RPCs with duplicate checks.
create or replace function public.create_roaster (
  p_name text,
  p_slug text,
  p_lng double precision default null,
  p_lat double precision default null
) returns public.roasters
language plpgsql
set search_path = public
as $$
declare
  u uuid := (select auth.uid());
  l geography;
  n text := public.normalize_entity_name(p_name);
  r public.roasters;
begin
  if u is null then
    raise exception 'Not authenticated';
  end if;
  if n = '' then
    raise exception 'Roaster name required';
  end if;
  if exists (
    select 1
    from public.roasters ro
    where ro.region_code = 'US' and ro.normalized_name = n
  ) then
    raise exception 'A roaster with a similar name already exists';
  end if;
  if p_lng is not null and p_lat is not null then
    l := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  else
    l := null;
  end if;
  if (p_lng is null) <> (p_lat is null) then
    raise exception 'Pass both lng and lat for HQ, or neither';
  end if;
  insert into public.roasters (name, slug, region_code, hq_location, created_by, is_verified)
  values (p_name, p_slug, 'US', l, u, false)
  returning * into r;
  return r;
end;
$$;

create or replace function public.create_cafe (
  p_name text,
  p_slug text,
  p_lng double precision,
  p_lat double precision,
  p_address jsonb default null
) returns public.cafes
language plpgsql
set search_path = public
as $$
declare
  u uuid := (select auth.uid());
  n text := public.normalize_entity_name(p_name);
  new_loc geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  r public.cafes;
begin
  if u is null then
    raise exception 'Not authenticated';
  end if;
  if n = '' then
    raise exception 'Cafe name required';
  end if;
  if exists (
    select 1
    from public.cafes ca
    where ca.region_code = 'US'
      and ca.normalized_name = n
      and st_dwithin(ca.location, new_loc, 120)
  ) then
    raise exception 'A cafe with a similar name already exists nearby';
  end if;
  insert into public.cafes (name, slug, region_code, location, address_json, created_by, is_verified)
  values (p_name, p_slug, 'US', new_loc, p_address, u, false)
  returning * into r;
  return r;
end;
$$;

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  level text not null default 'error',
  message text not null,
  path text,
  user_agent text,
  details jsonb,
  created_at timestamptz not null default now(),
  constraint client_errors_level_chk check (level in ('error', 'warn'))
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_user_idx on public.client_errors (user_id) where user_id is not null;

alter table public.client_errors enable row level security;

drop policy if exists "Insert client errors (anon/authed)" on public.client_errors;
create policy "Insert client errors (anon/authed)" on public.client_errors
  for insert to anon, authenticated
  with check (true);

drop policy if exists "Read own client errors" on public.client_errors;
create policy "Read own client errors" on public.client_errors
  for select to authenticated
  using (user_id = (select auth.uid()));

grant insert on public.client_errors to anon, authenticated, service_role;
grant select on public.client_errors to authenticated, service_role;

comment on table public.client_errors is 'Lightweight browser error telemetry for MVP observability.';
