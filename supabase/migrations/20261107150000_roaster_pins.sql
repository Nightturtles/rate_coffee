-- Pin roasters at a real street location when we know one.
-- hq_location is a city-level geocode, so stacking 10 SF roasters on one downtown
-- point misleads the map. Prefer the roaster's own cafe/roastery nearest the viewer;
-- fall back to the city point and say so via pin_kind ('cafe' | 'city').

drop function if exists public.discover_roasters(double precision, double precision, double precision, int);

create function public.discover_roasters(
  lat double precision, lng double precision,
  radius_m double precision default 50000, lim int default 50
) returns table (
  id uuid, slug text, name text, city text, region text, description text,
  roast_level public.roast_level, process_focus public.process_focus, single_origin_share numeric,
  curation_tier smallint, lat double precision, lng double precision, distance_m double precision,
  specialty_score int, active_coffee_count bigint, cafe_count bigint, pin_kind text
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g),
  pinned as (
    select
      r.*,
      (select c.location from public.cafes c
        where c.roaster_id = r.id and c.status <> 'closed'
        order by st_distance(c.location, o.g) limit 1) as cafe_pin
    from public.roasters r, origin o
    where r.status <> 'closed'
  )
  select
    r.id, r.slug, r.name, r.city, r.region, r.description,
    r.roast_level, r.process_focus, r.single_origin_share, r.curation_tier,
    st_y(coalesce(r.cafe_pin, r.hq_location)::geometry),
    st_x(coalesce(r.cafe_pin, r.hq_location)::geometry),
    st_distance(coalesce(r.cafe_pin, r.hq_location), o.g),
    rs.specialty_score, rs.active_coffee_count,
    (select count(*) from public.cafes c where c.roaster_id = r.id)
      + (select count(*) from public.cafe_roasters cr where cr.roaster_id = r.id),
    case when r.cafe_pin is not null then 'cafe' else 'city' end
  from pinned r
  join public.roaster_scores rs on rs.roaster_id = r.id, origin o
  where coalesce(r.cafe_pin, r.hq_location) is not null
    and st_dwithin(coalesce(r.cafe_pin, r.hq_location), o.g, radius_m)
  order by rs.specialty_score desc, st_distance(coalesce(r.cafe_pin, r.hq_location), o.g)
  limit lim
$$;

grant execute on function public.discover_roasters to anon, authenticated, service_role;
