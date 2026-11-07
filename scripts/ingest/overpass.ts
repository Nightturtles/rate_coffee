import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type OsmCafe = {
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hours: string | null;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  cuisine: string | null;
  is_roaster: boolean;
};

const CHAIN_RE =
  /\b(starbucks|peet'?s|philz|dutch bros|coffee bean|dunkin|7-eleven|mcdonald|panera|tim hortons|85\s?°?c|sharetea|gong cha|teaspoon|kung fu tea|happy lemon|tpumps|quickly|jamba|krispy|boba|bubble tea|tea station|teazzi|yifang|t4|chatime|tastea|ding tea|omomo|xing fu tang|cha for tea|urban ritual|sweetea|pressed|the coffee bean|biggby|einstein|noah'?s|safeway|target|barnes)\b/i;

function cacheFile(lat: number, lng: number, radius: number) {
  return `data/osm-cafes-${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}.json`;
}

/** amenity=cafe and shop=coffee within a radius, from the Overpass API. Cached on disk. */
export async function fetchOsmCafes(lat: number, lng: number, radiusM: number): Promise<OsmCafe[]> {
  const file = cacheFile(lat, lng, radiusM);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as OsmCafe[];
  const query = `[out:json][timeout:90];
(
  node["amenity"="cafe"](around:${radiusM},${lat},${lng});
  way["amenity"="cafe"](around:${radiusM},${lat},${lng});
  node["shop"="coffee"](around:${radiusM},${lat},${lng});
  way["shop"="coffee"](around:${radiusM},${lat},${lng});
);
out center tags;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "rate-coffee-ingest/0.1" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  const out: OsmCafe[] = [];
  for (const el of json.elements) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    const la = el.lat ?? el.center?.lat;
    const lo = el.lon ?? el.center?.lon;
    if (!name || la == null || lo == null) continue;
    if (t.cuisine && /bubble_tea|boba|tea$/.test(t.cuisine) && !/coffee/.test(t.cuisine)) continue;
    const site = t.website ?? t["contact:website"] ?? null;
    const insta = (t["contact:instagram"] ?? "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") || null;
    out.push({
      osm_id: `${el.type}/${el.id}`,
      name,
      lat: la,
      lng: lo,
      website: site && /^https?:\/\//.test(site) ? site : site ? `https://${site}` : null,
      instagram: insta,
      phone: t.phone ?? t["contact:phone"] ?? null,
      hours: t.opening_hours ?? null,
      address_line1: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || null,
      city: t["addr:city"] ?? null,
      postal_code: t["addr:postcode"] ?? null,
      cuisine: t.cuisine ?? null,
      is_roaster: t.shop === "coffee" || /roast/i.test(name) || t.craft === "coffee_roaster",
    });
  }
  writeFileSync(file, JSON.stringify(out, null, 2));
  return out;
}

export function isChain(name: string): boolean {
  return CHAIN_RE.test(name);
}
