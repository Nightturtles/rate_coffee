-- Discovery ranking. A "specialty score" (0-100-ish) that works before any check-ins exist,
-- built from catalog attributes and curation, then nudged by ratings as they arrive.

create or replace function public.roast_level_points(l public.roast_level)
returns int language sql immutable as $$
  select case l
    when 'ultra_light' then 15 when 'light' then 15 when 'medium_light' then 10
    when 'medium' then 0 when 'medium_dark' then -10 when 'dark' then -20 else 0 end
$$;

create or replace view public.roaster_scores with (security_invoker = on) as
select
  r.id as roaster_id,
  round(
    50
    + r.curation_tier * 10
    + public.roast_level_points(r.roast_level)
    + coalesce(r.single_origin_share, 0.5) * 15
    + case r.process_focus when 'experimental' then 5 when 'washed' then 5 else 0 end
    + least(coalesce(s.active_coffee_count, 0), 20) / 2.0
    + case when s.check_in_count > 0 then (coalesce(s.score, 3.5) - 3.5) * 10 else 0 end
  )::int as specialty_score,
  s.active_coffee_count,
  s.check_in_count,
  s.score as rating
from public.roasters r
left join public.roaster_stats s on s.roaster_id = r.id;

create or replace view public.cafe_scores with (security_invoker = on) as
with served as (
  select cr.cafe_id, rs.specialty_score, cr.relationship
  from public.cafe_roasters cr
  join public.roaster_scores rs on rs.roaster_id = cr.roaster_id
  union all
  select c.id, rs.specialty_score, 'owns'
  from public.cafes c
  join public.roaster_scores rs on rs.roaster_id = c.roaster_id
)
select
  c.id as cafe_id,
  case when agg.n is null then null else round(
    agg.best
    + case when c.roaster_id is not null or agg.owns > 0 then 10 else 0 end
    + least(greatest(agg.n - 1, 0) * 5, 15)
    + case when c.has_pourover then 5 else 0 end
    + c.curation_tier * 5
    + case when cs.check_in_count > 0 then (coalesce(cs.score, 3.5) - 3.5) * 10 else 0 end
  )::int end as specialty_score,
  coalesce(agg.n, 0)::int as roaster_count,
  agg.best as best_roaster_score,
  cs.check_in_count,
  cs.score as rating
from public.cafes c
left join (
  select cafe_id, count(*) as n, max(specialty_score) as best, count(*) filter (where relationship = 'owns') as owns
  from served group by cafe_id
) agg on agg.cafe_id = c.id
left join public.cafe_stats cs on cs.cafe_id = c.id;

grant select on public.roaster_scores, public.cafe_scores to anon, authenticated, service_role;

create or replace function public.discover_roasters(
  lat double precision, lng double precision,
  radius_m double precision default 50000, lim int default 50
) returns table (
  id uuid, slug text, name text, city text, region text, description text,
  roast_level public.roast_level, process_focus public.process_focus, single_origin_share numeric,
  curation_tier smallint, lat double precision, lng double precision, distance_m double precision,
  specialty_score int, active_coffee_count bigint, cafe_count bigint
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g)
  select
    r.id, r.slug, r.name, r.city, r.region, r.description,
    r.roast_level, r.process_focus, r.single_origin_share, r.curation_tier,
    st_y(r.hq_location::geometry), st_x(r.hq_location::geometry),
    st_distance(r.hq_location, o.g),
    rs.specialty_score, rs.active_coffee_count,
    (select count(*) from public.cafes c where c.roaster_id = r.id)
      + (select count(*) from public.cafe_roasters cr where cr.roaster_id = r.id)
  from public.roasters r
  join public.roaster_scores rs on rs.roaster_id = r.id, origin o
  where r.status <> 'closed' and r.hq_location is not null and st_dwithin(r.hq_location, o.g, radius_m)
  order by rs.specialty_score desc, st_distance(r.hq_location, o.g)
  limit lim
$$;

create or replace function public.discover_cafes(
  lat double precision, lng double precision,
  radius_m double precision default 25000, lim int default 100,
  with_signal boolean default true
) returns table (
  id uuid, slug text, name text, city text, address_line1 text,
  lat double precision, lng double precision, distance_m double precision,
  specialty_score int, roaster_count int, has_pourover boolean, has_batch_brew boolean,
  own_roaster_name text, own_roaster_slug text, roaster_names text[]
) language sql stable as $$
  with origin as (select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g)
  select
    c.id, c.slug, c.name, c.city, c.address_line1,
    st_y(c.location::geometry), st_x(c.location::geometry),
    st_distance(c.location, o.g),
    cs.specialty_score, cs.roaster_count, c.has_pourover, c.has_batch_brew,
    orr.name, orr.slug,
    coalesce((select array_agg(r.name order by r.name) from public.cafe_roasters cr join public.roasters r on r.id = cr.roaster_id where cr.cafe_id = c.id), '{}')
  from public.cafes c
  join public.cafe_scores cs on cs.cafe_id = c.id
  left join public.roasters orr on orr.id = c.roaster_id, origin o
  where c.status <> 'closed'
    and st_dwithin(c.location, o.g, radius_m)
    and (not with_signal or cs.specialty_score is not null)
  order by cs.specialty_score desc nulls last, st_distance(c.location, o.g)
  limit lim
$$;

grant execute on function public.roast_level_points, public.discover_roasters, public.discover_cafes to anon, authenticated, service_role;
