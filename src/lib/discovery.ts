import { createSupabasePublicClient } from "@/lib/supabase/public";

export type Place = { lat: number; lng: number; label: string };

export const PRESETS: Place[] = [
  { label: "Fremont", lat: 37.5485, lng: -121.9886 },
  { label: "Oakland", lat: 37.8044, lng: -122.2712 },
  { label: "San Jose", lat: 37.3382, lng: -121.8863 },
  { label: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { label: "Palo Alto", lat: 37.4419, lng: -122.143 },
  { label: "Santa Cruz", lat: 36.9741, lng: -122.0308 },
];

export const DEFAULT_PLACE = PRESETS[0];

export function placeFromParams(sp: Record<string, string | string[] | undefined>): Place {
  const lat = Number(sp.lat), lng = Number(sp.lng);
  const label = typeof sp.label === "string" && sp.label.trim() ? sp.label.trim().slice(0, 60) : "your location";
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, label };
  return DEFAULT_PLACE;
}

export function placeQuery(p: Place): string {
  return `lat=${p.lat.toFixed(4)}&lng=${p.lng.toFixed(4)}&label=${encodeURIComponent(p.label)}`;
}

export const MI = 1609.344;

/** Great-circle distance in meters. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function miles(m: number | null | undefined): string {
  if (m == null) return "";
  const mi = m / MI;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export type DiscoverRoaster = {
  id: string; slug: string; name: string; city: string | null; region: string | null; description: string | null;
  roast_level: string | null; process_focus: string | null; single_origin_share: number | null; curation_tier: number;
  lat: number; lng: number; distance_m: number; specialty_score: number; active_coffee_count: number; cafe_count: number;
  /** 'cafe' = pinned at the roaster's own cafe/roastery; 'city' = city-level geocode only. */
  pin_kind: "cafe" | "city";
  image_url: string | null;
};

export type DiscoverCafe = {
  id: string; slug: string; name: string; city: string | null; address_line1: string | null;
  lat: number; lng: number; distance_m: number; specialty_score: number | null; roaster_count: number;
  has_pourover: boolean | null; has_batch_brew: boolean | null; own_roaster_name: string | null; own_roaster_slug: string | null; roaster_names: string[];
  /** The cafe's own photo, or its roaster's when roaster-owned. */
  image_url: string | null;
};

export async function discoverRoasters(p: Place, radiusM = 35 * MI, lim = 50): Promise<DiscoverRoaster[]> {
  const db = createSupabasePublicClient();
  const { data, error } = await db.rpc("discover_roasters", { lat: p.lat, lng: p.lng, radius_m: radiusM, lim });
  if (error) throw new Error(error.message);
  return (data ?? []) as DiscoverRoaster[];
}

export async function discoverCafes(p: Place, radiusM = 15 * MI, lim = 100, withSignal = true): Promise<DiscoverCafe[]> {
  const db = createSupabasePublicClient();
  const { data, error } = await db.rpc("discover_cafes", { lat: p.lat, lng: p.lng, radius_m: radiusM, lim, with_signal: withSignal });
  if (error) throw new Error(error.message);
  return (data ?? []) as DiscoverCafe[];
}
