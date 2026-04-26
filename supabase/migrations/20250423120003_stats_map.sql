-- Map-friendly views, spatial RPCs, roll-up materialized view for v0.2+

create or replace view public.cafes_map
as
select
  c.id,
  c.name,
  c.slug,
  c.region_code,
  st_y (c.location::geometry) as lat,
  st_x (c.location::geometry) as lng,
  c.created_at
from public.cafes c
where c.region_code = 'US';

create or replace view public.roasters_map
as
select
  r.id,
  r.name,
  r.slug,
  r.region_code,
  st_y (r.hq_location::geometry) as lat,
  st_x (r.hq_location::geometry) as lng,
  r.created_at
from public.roasters r
where r.hq_location is not null
  and r.region_code = 'US';

-- Live rollups; switch to a materialized view + scheduled refresh if this becomes hot.
create or replace view public.roaster_stats as
select
  r.id as roaster_id,
  coalesce(
    count(cin.id) filter (where cin.visibility = 'public'),
    0::bigint
  ) as public_check_in_count,
  avg(cin.rating) filter (where cin.visibility = 'public') as public_avg_rating
from public.roasters r
left join public.coffees c on c.roaster_id = r.id
left join public.check_ins cin on cin.coffee_id = c.id
group by r.id;

create or replace function public.nearby_cafes (lat double precision, lng double precision, radius_meters double precision default 25000)
returns table (
  id uuid,
  name text,
  slug text,
  region_code text,
  out_lat double precision,
  out_lng double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.region_code,
    st_y (c.location::geometry)::double precision,
    st_x (c.location::geometry)::double precision,
    c.created_at
  from public.cafes c
  where c.region_code = 'US'
  and st_dwithin(
    c.location,
    st_setsrid (st_makepoint(lng, lat), 4326)::geography,
    radius_meters
  );
$$;

create or replace function public.nearby_roasters (lat double precision, lng double precision, radius_meters double precision default 25000)
returns table (
  id uuid,
  name text,
  slug text,
  region_code text,
  out_lat double precision,
  out_lng double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    r.id,
    r.name,
    r.slug,
    r.region_code,
    st_y (r.hq_location::geometry)::double precision,
    st_x (r.hq_location::geometry)::double precision,
    r.created_at
  from public.roasters r
  where r.region_code = 'US'
  and r.hq_location is not null
  and st_dwithin(
    r.hq_location,
    st_setsrid (st_makepoint(lng, lat), 4326)::geography,
    radius_meters
  );
$$;

grant select on public.roaster_stats to authenticated, service_role, anon;
grant select on public.cafes_map, public.roasters_map to authenticated, service_role, anon;
grant execute on function public.nearby_cafes to authenticated, anon, service_role;
grant execute on function public.nearby_roasters to authenticated, anon, service_role;
