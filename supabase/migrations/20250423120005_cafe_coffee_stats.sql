-- Additional roll-up views (live)

create or replace view public.cafe_stats as
select
  c.id as cafe_id,
  coalesce(
    count(cin.id) filter (where cin.visibility = 'public'),
    0::bigint
  ) as public_check_in_count,
  avg(cin.rating) filter (where cin.visibility = 'public') as public_avg_rating
from public.cafes c
left join public.check_ins cin on cin.cafe_id = c.id
group by c.id;

create or replace view public.coffee_stats as
select
  co.id as coffee_id,
  coalesce(
    count(cin.id) filter (where cin.visibility = 'public'),
    0::bigint
  ) as public_check_in_count,
  avg(cin.rating) filter (where cin.visibility = 'public') as public_avg_rating
from public.coffees co
left join public.check_ins cin on cin.coffee_id = co.id
group by co.id;

grant select on public.cafe_stats, public.coffee_stats to authenticated, anon, service_role;
