# rate coffee (MVP)

Web-first “Untappd for coffee”: log check-ins, add roasters/cafes/coffees, and browse a **US** map. Backend is [Supabase](https://supabase.com/) (Postgres + PostGIS, Auth, RLS). The web app is a static [Next.js](https://nextjs.org/) build suitable for [GitHub Pages](https://pages.github.com/); set `NEXT_PUBLIC_BASE_PATH` when using a project Pages URL.

## Prerequisites

- Node 20+
- A Supabase project
- (Optional) [Supabase CLI](https://supabase.com/docs/guides/cli) for `supabase db push` / local

## Setup

1. Clone the repo and install from the monorepo root:
  ```bash
   cd rate_coffee
   rm -f apps/web/package-lock.json
   npm install
  ```
2. Link the project: **Project Settings → API** and copy the URL and anon public key.
3. Copy [apps/web/.env.local.example](apps/web/.env.local.example) to `apps/web/.env.local` and set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Apply database migrations in the Supabase SQL editor or with the CLI:
  ```bash
   supabase link
   supabase db push
  ```
   Migrations live under [supabase/migrations/](supabase/migrations/). They enable PostGIS, create tables, RLS, seed `brew_methods` and `tags`, and add `nearby_cafes` / `nearby_roasters` RPCs.
5. In the Supabase dashboard, **Auth → URL configuration**:
  - **Site URL**: e.g. `http://127.0.0.1:3000` for local dev, or your GitHub Pages site URL
  - **Redirect URLs**: include `http://127.0.0.1:3000/auth/callback` (or your `basePath` + `/auth/callback`) and production URLs
  - Enable the **Google** provider if you use it
6. Run the app:
  ```bash
   npm run dev
  ```
   Open `http://127.0.0.1:3000` (and `/log` after signing in) to add catalog rows and check-ins.

## Build (static export)

```bash
npm run build
```

Output is in `apps/web/out` (GitHub Actions deploy this folder in the included workflow). For a project page like `https://<user>.github.io/rate_coffee/`, set in `apps/web/.env.local` before build:

`NEXT_PUBLIC_BASE_PATH=/rate_coffee`

(Replace with your repository name, including leading slash.)

## Testing

- Unit: `npm test` (Vitest)
- E2E: `npx playwright install` once, then `npm run test:e2e` (see [e2e/](e2e/))

## Docs

- [docs/PRODUCT.md](docs/PRODUCT.md) — MVP product defaults (region, visibility, rating)
- [docs/RLS.md](docs/RLS.md) — RLS policy summary
- [supabase/seed-example.sql](supabase/seed-example.sql) — optional **sample data** (run manually in SQL editor after migrations)

## Repository layout


| Path                                       | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| [apps/web](apps/web)                       | Next.js (App Router) UI           |
| [packages/shared](packages/shared)         | Zod + shared strings              |
| [supabase/migrations](supabase/migrations) | SQL schema + RLS                  |
| [e2e](e2e)                                 | Playwright tests                  |
| [.github/workflows](.github/workflows)     | CI, build, deploy to GitHub Pages |


## Open decisions

Map tiles use CARTO Voyager; replace if you need different terms or style. Add your own optional seed/POI import in a follow-up; the hybrid catalog plan assumes you seed a few US metros and let users add the long tail.