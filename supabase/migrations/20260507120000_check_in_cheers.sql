-- "Cheers" reactions on public check-ins. Composite primary key enforces
-- one cheer per (check_in, user). Toggling "off" is a delete.

create table public.check_in_cheers (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (check_in_id, user_id)
);

create index check_in_cheers_user_idx on public.check_in_cheers (user_id);

alter table public.check_in_cheers enable row level security;

create policy "Read check_in_cheers" on public.check_in_cheers
  for select
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_cheers.check_in_id
        and (c.visibility = 'public' or c.user_id = (select auth.uid()))
    )
    or user_id = (select auth.uid())
  );

create policy "Insert own cheer" on public.check_in_cheers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.visibility = 'public'
    )
  );

create policy "Delete own cheer" on public.check_in_cheers
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.check_in_cheers to anon, authenticated;
grant insert, delete on public.check_in_cheers to authenticated;
