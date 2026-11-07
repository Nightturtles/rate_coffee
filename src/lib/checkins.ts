import type { SupabaseClient } from "@supabase/supabase-js";

export type CheckInRow = {
  id: string; rating: number; notes: string | null; consumed_at: string; visibility: "public" | "private"; user_id: string;
  brew_methods: { label: string } | null;
  coffees: { name: string } | null;
  roasters: { name: string; slug: string } | null;
  cafes: { name: string; slug: string } | null;
  check_in_tags: { flavor_tags: { label: string } | null }[];
  profile: { display_name: string | null; handle: string | null } | null;
};

const SELECT = "id, rating, notes, consumed_at, visibility, user_id, brew_methods(label), coffees(name), roasters(name, slug), cafes(name, slug), check_in_tags(flavor_tags(label))";

/** Check-ins for one subject or user, newest first, with the author's profile attached. RLS decides what's visible. */
export async function fetchCheckIns(db: SupabaseClient, by: { roasterId?: string; cafeId?: string; coffeeId?: string; userId?: string }, limit = 20): Promise<CheckInRow[]> {
  let q = db.from("check_ins").select(SELECT).order("consumed_at", { ascending: false }).limit(limit);
  if (by.roasterId) q = q.eq("roaster_id", by.roasterId);
  if (by.cafeId) q = q.eq("cafe_id", by.cafeId);
  if (by.coffeeId) q = q.eq("coffee_id", by.coffeeId);
  if (by.userId) q = q.eq("user_id", by.userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Omit<CheckInRow, "profile">[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const profiles = new Map<string, CheckInRow["profile"]>();
  if (ids.length) {
    const { data: ps } = await db.from("profiles").select("id, display_name, handle").in("id", ids);
    for (const p of ps ?? []) profiles.set(p.id, { display_name: p.display_name, handle: p.handle });
  }
  return rows.map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null }));
}
