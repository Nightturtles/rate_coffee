# rate coffee

Untappd for specialty coffee: find good roasters, and the cafes that serve them. Fresh build (v2); the original MVP is tagged `legacy-mvp`.

Stack: Next.js (App Router, server rendering) on Vercel, Supabase (Postgres + PostGIS, auth, RLS).

## Local dev

1. `cp .env.example .env.local` and fill in the Supabase URL and anon key.
2. `npm install`
3. `npm run dev` and open http://localhost:3000. `/api/health` reports whether Supabase is reachable.

## Deploy

Live at https://rate-coffee.vercel.app (Vercel project `rate-coffee`, team Cafelytic). Vercel builds `main` as production on every push. Set the same env vars in Vercel project settings. Keep the app portable: no Vercel-only storage or APIs, so it can move to Cloudflare via OpenNext if needed.

## Sign-in

Passwordless, via Supabase Auth. The sign-in email carries a six-digit code and a link; the code is
the primary path because corporate and Gmail link scanners can open (and spend) a magic link before
the user does, and because it works when the email is read on another device.

Setup that lives in the Supabase dashboard, not in code:

1. **Email templates** (Authentication -> Emails): paste `supabase/templates/magic_link.html` into
   *Magic Link* and `supabase/templates/confirmation.html` into *Confirm signup*, with the subject
   "Your Rate Coffee sign-in code". `supabase config push` applies the same from `supabase/config.toml`.
2. **URL configuration**: Site URL `https://rate-coffee.vercel.app`, redirect allow-list
   `https://rate-coffee.vercel.app/**` and `http://localhost:3000/**`.
3. **Google sign-in** (optional): create an OAuth client in Google Cloud (Web application; authorised
   redirect URI is the callback URL shown on the Google provider card in Supabase), enable the Google
   provider in Supabase with its client ID and secret, then set `NEXT_PUBLIC_AUTH_GOOGLE=1` on Vercel
   to show the button.
4. **Custom SMTP** (before inviting people): the built-in mailer allows 2 emails per hour. Any SMTP
   provider works (Resend, Postmark, SES) but all need a sending domain you own; `vercel.app` won't do.

