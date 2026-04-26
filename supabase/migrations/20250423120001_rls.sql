-- Row level security. See docs/RLS.md for the policy matrix.
alter table public.profiles enable row level security;
alter table public.roasters enable row level security;
alter table public.cafes enable row level security;
alter table public.coffees enable row level security;
alter table public.cafe_roaster enable row level security;
alter table public.brew_methods enable row level security;
alter table public.tags enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_tags enable row level security;

-- Profiles: everyone can read minimal fields for public discovery; users update their own
create policy "Public read profiles" on public.profiles
  for select using (true);

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Read-only reference data
create policy "Anyone read brew_methods" on public.brew_methods
  for select using (true);

create policy "Anyone read tags" on public.tags
  for select using (true);

-- Roasters / cafes / coffees
create policy "Anyone read roasters" on public.roasters
  for select using (true);

create policy "Authed create roaster" on public.roasters
  for insert to authenticated
  with check (created_by is not null and created_by = (select auth.uid()));

create policy "Authed update own roaster" on public.roasters
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "Authed delete own roaster" on public.roasters
  for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Anyone read cafes" on public.cafes
  for select using (true);

create policy "Authed create cafe" on public.cafes
  for insert to authenticated
  with check (created_by is not null and created_by = (select auth.uid()));

create policy "Authed update own cafe" on public.cafes
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "Authed delete own cafe" on public.cafes
  for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Anyone read coffees" on public.coffees
  for select using (true);

create policy "Authed create coffee" on public.coffees
  for insert to authenticated
  with check (created_by is not null and created_by = (select auth.uid()));

create policy "Authed update own coffee" on public.coffees
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "Authed delete own coffee" on public.coffees
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- Cafe ↔ roaster links
create policy "Anyone read cafe_roaster" on public.cafe_roaster
  for select using (true);

create policy "Authed create cafe_roaster" on public.cafe_roaster
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Authed delete own cafe_roaster" on public.cafe_roaster
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- Check-ins: visibility
create policy "Read check_ins visible" on public.check_ins
  for select
  using (
    visibility = 'public'
    or (select auth.uid()) = user_id
  );

create policy "Insert own check_ins" on public.check_ins
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select auth.uid()) is not null);

create policy "Update own check_ins" on public.check_ins
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Delete own check_ins" on public.check_ins
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Tags on check-in
create policy "Read check_in_tags" on public.check_in_tags
  for select
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_tags.check_in_id
        and (
          c.visibility = 'public' or c.user_id = (select auth.uid())
        )
    )
  );

create policy "Insert check_in_tags own" on public.check_in_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.check_ins c where c.id = check_in_tags.check_in_id and c.user_id = (select auth.uid()))
  );

create policy "Delete check_in_tags own" on public.check_in_tags
  for delete to authenticated
  using (
    exists (select 1 from public.check_ins c where c.id = check_in_tags.check_in_id and c.user_id = (select auth.uid()))
  );

-- Grant explicit table privileges (Supabase: rely on RLS; defaults allow authenticated)
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.roasters, public.cafes, public.coffees, public.cafe_roaster, public.check_ins, public.check_in_tags to authenticated;
grant update on public.profiles to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role, authenticated;

-- Allow anon to read for discovery; writes governed by RLS
grant select on all tables in schema public to anon;

-- Storage for avatars (public bucket) — add via dashboard or follow-up migration

comment on table public.brew_methods is 'Reference data: writes via service role (seeds) only.';
