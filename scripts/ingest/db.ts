import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import type { CoffeeRecord, RoasterAttributes, RoasterSeed } from "./types";

export function serviceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Db = ReturnType<typeof serviceClient>;

export function slugify(s: string): string {
  return (
    s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item"
  );
}

export async function upsertRoaster(
  db: Db,
  seed: RoasterSeed,
  attrs: RoasterAttributes,
  geo: { lat: number; lng: number } | null,
  shopOrigin: string | null,
  description: string | null,
  platform = "none",
): Promise<string> {
  const slug = slugify(seed.name);
  const row = {
    slug,
    name: seed.name,
    website: seed.website,
    shop_url: shopOrigin,
    instagram: seed.instagram ?? null,
    description,
    city: seed.city,
    region: seed.state ?? "CA",
    country_code: seed.country_code ?? "US",
    hq_location: geo ? `SRID=4326;POINT(${geo.lng} ${geo.lat})` : null,
    roast_level: attrs.roast_level,
    process_focus: attrs.process_focus,
    single_origin_share: attrs.single_origin_share,
    curation_tier: seed.curation_tier ?? 1,
    source: platform === "shopify" ? "shopify" : platform === "none" ? "import" : "roaster_site",
    source_url: seed.website,
    attributes_updated_at: new Date().toISOString(),
  };
  // Match on slug first; fall back to the normalized-name unique index.
  const existing = await db.from("roasters").select("id").eq("slug", slug).maybeSingle();
  if (existing.data?.id) {
    const { error } = await db.from("roasters").update(row).eq("id", existing.data.id);
    if (error) throw new Error(`update roaster ${seed.name}: ${error.message}`);
    return existing.data.id;
  }
  const { data, error } = await db.from("roasters").insert(row).select("id").single();
  if (error) throw new Error(`insert roaster ${seed.name}: ${error.message}`);
  return data.id;
}

export async function upsertCoffees(db: Db, roasterId: string, coffees: CoffeeRecord[], platform = "shopify"): Promise<{ upserted: number; archived: number }> {
  if (coffees.length === 0) return { upserted: 0, archived: 0 };
  const now = new Date().toISOString();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const seenSlugs = new Set<string>();
  const seenNames = new Set<string>();
  const rows = [...coffees]
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1))
    .filter((c) => {
      const n = norm(c.name);
      if (seenSlugs.has(c.slug) || seenNames.has(n)) return false;
      seenSlugs.add(c.slug);
      seenNames.add(n);
      return true;
    })
    .map((c) => ({
      roaster_id: roasterId,
      slug: c.slug,
      name: c.name,
      is_blend: c.is_blend,
      roast_level: c.roast_level,
      origin_country_code: c.origin_country_code,
      origin_region: c.origin_region,
      producer: c.producer,
      varieties: c.varieties,
      process: c.process,
      process_family: c.process_family,
      tasting_notes: c.tasting_notes,
      price_cents: c.price_cents,
      size_grams: c.size_grams,
      url: c.url,
      image_url: c.image_url,
      status: c.status,
      last_seen_at: now,
      source: platform === "shopify" ? "shopify" : "roaster_site",
      external_id: c.external_id,
    }));
  const { error } = await db.from("coffees").upsert(rows, { onConflict: "roaster_id,slug", ignoreDuplicates: false });
  if (error) throw new Error(`upsert coffees: ${error.message}`);
  // Anything from this source we did not see this run is off the menu.
  const ids = rows.map((r) => r.external_id);
  const { data: stale, error: e2 } = await db
    .from("coffees")
    .update({ status: "closed" })
    .eq("roaster_id", roasterId)
    .in("source", ["shopify", "roaster_site"])
    .not("external_id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`)
    .eq("status", "active")
    .select("id");
  if (e2) throw new Error(`archive coffees: ${e2.message}`);
  return { upserted: rows.length, archived: stale?.length ?? 0 };
}
