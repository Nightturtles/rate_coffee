# Filtered

Untappd for specialty coffee: find good roasters, and the cafes that serve them. Fresh build (v2); the original MVP is tagged `legacy-mvp`.

Stack: Next.js (App Router, server rendering) on Vercel, Supabase (Postgres + PostGIS, auth, RLS).

## Local dev

1. `cp .env.example .env.local` and fill in the Supabase URL and anon key.
2. `npm install`
3. `npm run dev` and open http://localhost:3000. `/api/health` reports whether Supabase is reachable.

## Deploy

Live at https://filtered.cafe (Vercel project `rate-coffee`, team Cafelytic; `rate-coffee.vercel.app` still resolves). The domain is registered and its DNS hosted at Cloudflare: an `A` record for the apex and a `CNAME` for `www`, both DNS-only (not proxied), with values from `vercel domains verify filtered.cafe`. Vercel builds `main` as production on every push. Set the same env vars in Vercel project settings, or with the CLI: `vercel link --project rate-coffee` once, then `vercel env add NAME production`, `vercel env ls`, and `vercel redeploy rate-coffee.vercel.app --environment production` to rebuild after a variable change (`NEXT_PUBLIC_*` values are baked in at build time). Keep the app portable: no Vercel-only storage or APIs, so it can move to Cloudflare via OpenNext if needed.

## Sign-in

Passwordless, via Supabase Auth. The sign-in email carries a numeric code and a link (the code length, 6 to 10 digits, is set in the dashboard under Sign In / Providers -> Email -> Email OTP Length; the hosted project issues 8); the code is
the primary path because corporate and Gmail link scanners can open (and spend) a magic link before
the user does, and because it works when the email is read on another device.

Setup that lives in the Supabase dashboard, not in code:

1. **Email templates** (Authentication -> Emails): paste `supabase/templates/magic_link.html` into
   *Magic Link* and `supabase/templates/confirmation.html` into *Confirm signup*, with the subject
   "Your Filtered sign-in code". `supabase config push` applies the same from `supabase/config.toml`.
2. **URL configuration**: Site URL `https://filtered.cafe`, redirect allow-list
   `https://filtered.cafe/**`, `https://www.filtered.cafe/**`, `https://rate-coffee.vercel.app/**` and
   `http://localhost:3000/**`. Sign-in redirects to whichever host the visitor is on, so a host missing
   from the list falls back to the Site URL.
3. **Google sign-in** (optional): create an OAuth client in Google Cloud (Web application; authorised
   redirect URI is the callback URL shown on the Google provider card in Supabase), enable the Google
   provider in Supabase with its client ID and secret, then set `NEXT_PUBLIC_AUTH_GOOGLE=1` on Vercel
   to show the button. To publish the consent screen (Google Auth Platform -> Audience), the Branding
   page needs app name Filtered, homepage `https://filtered.cafe`, privacy policy
   `https://filtered.cafe/privacy` and authorised domain `filtered.cafe`, which must first be verified
   in Google Search Console with a DNS TXT record.
4. **Custom SMTP** (before inviting people): the built-in mailer allows 2 emails per hour. Any SMTP
   provider works (Resend, Postmark, SES) and sends from `filtered.cafe` once its DNS records are added.

