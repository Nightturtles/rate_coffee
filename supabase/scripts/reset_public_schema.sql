-- ONE-TIME: wipe the v1 schema so v2 migrations start clean. Keeps auth.users.
-- Run with: npx supabase db query --remote --file supabase/scripts/reset_public_schema.sql
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
-- Restore Supabase's default privileges for objects the migration role creates.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
-- Forget v1 migration history so v2 applies from scratch.
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations;
  end if;
end $$;
