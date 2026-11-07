import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CACHE_FILE = "data/geocode-cache.json";
const UA = "rate-coffee-ingest/0.1";

type Hit = { lat: number; lng: number; display: string };
let cache: Record<string, Hit | null> | null = null;

function loadCache() {
  if (cache) return cache;
  cache = existsSync(CACHE_FILE) ? (JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, Hit | null>) : {};
  return cache;
}

/** City-level geocode via OpenStreetMap Nominatim (1 req/s policy). Cached on disk. */
export async function geocodeCity(city: string, region: string, country = "US"): Promise<Hit | null> {
  const key = `${city}, ${region}, ${country}`.toLowerCase();
  const c = loadCache();
  if (key in c) return c[key];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${city}, ${region}, ${country}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  let hit: Hit | null = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (rows[0]) hit = { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), display: rows[0].display_name };
    }
  } catch {
    hit = null;
  }
  c[key] = hit;
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
  await new Promise((r) => setTimeout(r, 1100));
  return hit;
}

/** Address-level geocode (street + city). Cached, 1 req/s. */
export async function geocodeAddress(q: string): Promise<Hit | null> {
  const key = `addr:${q.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const c = loadCache();
  if (key in c) return c[key];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  let hit: Hit | null = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (rows[0]) hit = { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), display: rows[0].display_name };
    }
  } catch {
    hit = null;
  }
  c[key] = hit;
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
  await new Promise((r) => setTimeout(r, 1100));
  return hit;
}
