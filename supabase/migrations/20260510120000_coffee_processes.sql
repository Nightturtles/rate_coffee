-- Processing methods (washed, natural, honey, etc.)

create table public.coffee_processes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0
);

alter table public.coffees
  add column if not exists process_id uuid references public.coffee_processes (id) on delete restrict;

create index if not exists coffees_process_idx on public.coffees (process_id);

insert into public.coffee_processes (slug, label, sort_order) values
  ('washed', 'Washed', 10),
  ('natural', 'Natural', 20),
  ('honey', 'Honey', 30),
  ('black-honey', 'Black honey', 40),
  ('red-honey', 'Red honey', 50),
  ('yellow-honey', 'Yellow honey', 60),
  ('white-honey', 'White honey', 70),
  ('anaerobic', 'Anaerobic', 80),
  ('anaerobic-natural', 'Anaerobic natural', 90),
  ('anaerobic-washed', 'Anaerobic washed', 100),
  ('carbonic-maceration', 'Carbonic maceration', 110),
  ('wet-hulled', 'Wet-hulled', 120),
  ('pulped-natural', 'Pulped natural', 130),
  ('semi-washed', 'Semi-washed', 140),
  ('experimental', 'Experimental', 150);

alter table public.coffee_processes enable row level security;

create policy "Anyone read coffee_processes" on public.coffee_processes
  for select using (true);

grant select on public.coffee_processes to anon, authenticated;
