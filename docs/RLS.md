# Row Level Security policy matrix (Supabase)

Summary of the policies in [supabase/migrations/20250423120001_rls.sql](supabase/migrations/20250423120001_rls.sql). Service role and postgres bypass RLS and are for migrations, seeds, and server-side automation only.

| Table | `anon` | `authenticated` | Notes |
|--------|--------|------------------|--------|
| `profiles` | `SELECT` all | `SELECT` all; `UPDATE` own row | Row created on signup via `handle_new_user` (security definer) |
| `brew_methods` | `SELECT` | `SELECT` | Seeded; no user `INSERT`/`UPDATE` (blocked by RLS) |
| `tags` | `SELECT` | `SELECT` | Same as `brew_methods` |
| `roasters`, `cafes`, `coffees` | `SELECT` | `SELECT`; `INSERT` with `created_by = auth.uid()`; `UPDATE`/`DELETE` own | Public discovery; ownership via `created_by` |
| `cafe_roaster` | `SELECT` | `INSERT` with `created_by = auth.uid()`; `DELETE` own | Links a cafe to a roaster |
| `check_ins` | `SELECT` where `visibility = 'public'` | `SELECT` public **or** own; full `INSERT`/`UPDATE`/`DELETE` own | Private rows only visible to owner |
| `check_in_tags` | `SELECT` if parent check-in visible | `INSERT`/`UPDATE`/`DELETE` only when the parent `check_in.user_id` matches | Junction table |

**Notes**

- Tasting `notes` on a check-in follow the same row visibility as the check-in; there is no separate `notes` column RLS. To hide `notes` while keeping aggregates public, split into a `check_in_private` table in a later iteration.
- `roaster_stats` and map helper views use underlying table RLS; stats only include public check-ins in the count/avg as defined in the view.
