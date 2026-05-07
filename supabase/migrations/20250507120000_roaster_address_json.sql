-- Optional structured/display address for roasters (coordinates remain hq_location).

alter table public.roasters
  add column if not exists address_json jsonb;

drop function if exists public.create_roaster(text, text, double precision, double precision);

create or replace function public.create_roaster (
  p_name text,
  p_slug text,
  p_lng double precision default null,
  p_lat double precision default null,
  p_address jsonb default null
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
  insert into public.roasters (name, slug, region_code, hq_location, address_json, created_by, is_verified)
  values (p_name, p_slug, 'US', l, p_address, u, false)
  returning * into r;
  return r;
end;
$$;

grant execute on function public.create_roaster(text, text, double precision, double precision, jsonb) to authenticated, service_role;

comment on function public.create_roaster is 'Creates a roaster with optional US HQ coords and optional address_json; slugs are unique per region. Called from the web app.';
