# rate coffee

Untappd for specialty coffee: find good roasters, and the cafes that serve them. Fresh build (v2); the original MVP is tagged `legacy-mvp`.

Stack: Next.js (App Router, server rendering) on Vercel, Supabase (Postgres + PostGIS, auth, RLS).

## Local dev

1. `cp .env.example .env.local` and fill in the Supabase URL and anon key.
2. `npm install`
3. `npm run dev` and open http://localhost:3000. `/api/health` reports whether Supabase is reachable.

## Deploy

Vercel builds from this repo on every push. Set the same env vars in Vercel project settings. Keep the app portable: no Vercel-only storage or APIs, so it can move to Cloudflare via OpenNext if needed.
