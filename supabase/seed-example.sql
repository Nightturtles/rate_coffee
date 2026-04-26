-- Optional: run in Supabase SQL editor *after* migrations, for a one-click demo in the US.
-- Tweak names/coordinates as needed. Uses existing RPCs and RLS as the authenticated test user
-- in the dashboard (not applicable here) — for local dev, use the app UI after sign-up instead;
-- or run the inserts below with the service role / SQL editor (bypasses RLS for inserts on behalf of users
-- is non-trivial). Simplest: add data via the /log page. This file is documentation-only sample SQL
-- shape for bulk seed jobs later.

-- Example point for NYC
-- select public.create_cafe('Demo Cafe', 'demo-cafe-abc123', -74.0, 40.7, null);
-- select public.create_roaster('Demo Roaster', 'demo-roaster-xyz', -73.99, 40.75);
