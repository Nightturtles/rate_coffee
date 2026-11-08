-- Expose each roaster's and cafe's mark (logo_url) through the discovery RPCs so list
-- thumbnails can show the brand rather than a stock photo. Roaster-owned cafes inherit
-- the roaster's mark when they have none of their own.

drop function if exists public.discover_roasters(double precision, double precision, double precision, int);

create function public.discover_roasters(
  lat double precision, lng double precision,
  radius_m double precision default 50000, lim int default 50
) returns table (
  id uuid, slug text, name text, city text, region text, description text,
  roast_level public.roast_level, process_focus public.process_focus, single_origin_share numeric,
  curation_tier smallint, lat double precision, lng double precision, distance_m double precision,
  specialty_score int, active_coffee_count bigint, cafe_count bigint, pin_kind text, image_url text, logo_url text
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
    case when r.cafe_pin is not null then 'cafe' else 'city' end,
    r.image_url, r.logo_url
  from pinned r
  join public.roaster_scores rs on rs.roaster_id = r.id, origin o
  where coalesce(r.cafe_pin, r.hq_location) is not null
    and st_dwithin(coalesce(r.cafe_pin, r.hq_location), o.g, radius_m)
  order by rs.specialty_score desc, st_distance(coalesce(r.cafe_pin, r.hq_location), o.g)
  limit lim
$$;

drop function if exists public.discover_cafes(double precision, double precision, double precision, int, boolean);

create function public.discover_cafes(
  lat double precision, lng double precision,
  radius_m double precision default 25000, lim int default 100,
  with_signal boolean default true
) returns table (
  id uuid, slug text, name text, city text, address_line1 text,
  lat double precision, lng double precision, distance_m double precision,
  specialty_score int, roaster_count int, has_pourover boolean, has_batch_brew boolean,
  own_roaster_name text, own_roaster_slug text, roaster_names text[], image_url text, logo_url text
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g)
  select
    c.id, c.slug, c.name, c.city, c.address_line1,
    st_y(c.location::geometry), st_x(c.location::geometry),
    st_distance(c.location, o.g),
    cs.specialty_score, cs.roaster_count, c.has_pourover, c.has_batch_brew,
    orr.name, orr.slug,
    coalesce((select array_agg(r.name order by r.name) from public.cafe_roasters cr join public.roasters r on r.id = cr.roaster_id where cr.cafe_id = c.id), '{}'),
    coalesce(c.image_url, orr.image_url),
    coalesce(c.logo_url, orr.logo_url)
  from public.cafes c
  join public.cafe_scores cs on cs.cafe_id = c.id
  left join public.roasters orr on orr.id = c.roaster_id, origin o
  where c.status <> 'closed'
    and st_dwithin(c.location, o.g, radius_m)
    and (not with_signal or cs.specialty_score is not null)
  order by cs.specialty_score desc nulls last, st_distance(c.location, o.g)
  limit lim
$$;

grant execute on function public.discover_roasters, public.discover_cafes to anon, authenticated, service_role;
