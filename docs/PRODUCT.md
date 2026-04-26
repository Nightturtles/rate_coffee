# Product spec (MVP) — internal

Decisions captured for v0.1+ implementation. Adjust if product direction changes.

## Geographic scope (MVP)

- **Primary region:** United States (`region_code` = `US` on roasters, cafes, and profile defaults).
- **Data policy:** New roaster/cafe/coffee rows are expected to be US-located; map and discovery queries filter to **US** until multi-region is explicitly enabled.
- **Future:** Add more `region_code` values and user-selectable home region without schema redesign.

## Check-in visibility

- **Default:** Check-ins are **public** (visible in aggregate on roaster/cafe/coffee and in discovery), with `visibility` = `public` on `check_ins`.
- **Private option:** Schema supports `visibility` = `private` for a personal-only log; RLS enforces that only the owner can read private rows. UI may expose this in a later iteration; v0.1 can default to public only for simplicity.

## Rating scale

- **Scale:** **0.5 to 5.0** in **0.5** steps (aligns with common “star” UX while staying numeric in DB).
- **Storage:** `numeric(2,1)` or `double precision` with app-level validation; aggregation uses `avg()` in SQL.

## Auth (MVP)

- Email (magic link and/or password per Supabase settings) and **Google OAuth**.
- Redirect URLs must include production GitHub Pages domain and local dev URLs in Supabase dashboard.
