-- Optional RPCs: geography insert from the static web client (RLS still applies; security invoker = caller)

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
  r public.roasters;
begin
  if u is null then
    raise exception 'Not authenticated';
  end if;
  if p_lng is not null and p_lat is not null then
    l := st_setsrid (st_makepoint (p_lng, p_lat), 4326)::geography;
  else
    l := null;
  end if;
  if (p_lng is null) <> (p_lat is null) then
    raise exception 'Pass both lng and lat for HQ, or neither';
  end if;
  insert into public.roasters (name, slug, region_code, hq_location, created_by)
  values (p_name, p_slug, 'US', l, u) returning * into r;
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
  r public.cafes;
begin
  if u is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.cafes (name, slug, region_code, location, address_json, created_by)
  values (p_name, p_slug, 'US', st_setsrid (st_makepoint (p_lng, p_lat), 4326)::geography, p_address, u) returning * into r;
  return r;
end;
$$;

grant execute on function public.create_roaster to authenticated, service_role;
grant execute on function public.create_cafe to authenticated, service_role;

comment on function public.create_roaster is 'Creates a roaster with optional US HQ; slugs are unique per region. Called from the web app.';
comment on function public.create_cafe is 'Creates a cafe with required coordinates. Called from the web app.';
