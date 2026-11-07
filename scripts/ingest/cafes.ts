/**
 * Cafe ingestion for one metro area.
 *
 *   npx tsx scripts/ingest/cafes.ts [--center lat,lng] [--radius-km 20] [--skip-stockists] [--skip-sites] [--dry-run]
 *
 * 1. OpenStreetMap cafes within the radius become catalog rows (chains excluded).
 * 2. Each roaster's "where to find us" page is extracted with Claude into cafe->roaster links.
 * 3. Cafe websites are scanned for roaster names and brew-menu keywords.
 */
import { writeFileSync } from "node:fs";
import { loadEnv } from "./env";
import { serviceClient, slugify } from "./db";
import { fetchOsmCafes, isChain } from "./overpass";
import { findStockistPage, extractStockists, type Stockist } from "./stockists";
import { geocodeAddress } from "./geocode";
import { stripHtml } from "./shopify";

loadEnv();

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : d);
const [LAT, LNG] = opt("--center", "37.5485,-121.9886").split(",").map(Number);
const RADIUS_M = Number(opt("--radius-km", "20")) * 1000;
const dryRun = flag("--dry-run");

const UA = "rate-coffee-ingest/0.1 (catalog research)";
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\b(the|cafe|café|coffee|co|company|roasters|roastery|roasting|shop|house|bar|llc|inc)\b/g, " ").replace(/\s+/g, " ").trim();

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type CafeRow = {
  id?: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  address_line1: string | null;
  city: string | null;
  region: string;
  postal_code: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hours: unknown;
  osm_id: string | null;
  roaster_id: string | null;
  has_espresso: boolean | null;
  has_pourover: boolean | null;
  has_batch_brew: boolean | null;
  is_multi_roaster: boolean | null;
  source: string;
  source_url: string | null;
};

type Link = { cafe_slug: string; roaster_id: string; relationship: string; source: string; source_url: string; confidence: number };

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return "";
    return stripHtml(await res.text());
  } catch {
    return "";
  }
}

function brewAttrs(text: string) {
  const t = text.toLowerCase();
  return {
    has_espresso: /espresso|latte|cappuccino|cortado|flat white/.test(t) ? true : null,
    has_pourover: /pour[- ]?over|v60|chemex|kalita|hand[- ]brew|single[- ]origin pour/.test(t) ? true : null,
    has_batch_brew: /batch brew|drip coffee|batch coffee|brewed coffee|daily brew/.test(t) ? true : null,
  };
}

async function main() {
  const db = dryRun ? null : serviceClient();
  const client = db ?? serviceClient();
  const { data: roasters, error: rErr } = await client.from("roasters").select("id, name, slug, website, city").order("name");
  if (rErr || !roasters) throw new Error(`roasters: ${rErr?.message}`);
  const roasterByNorm = new Map(roasters.map((r) => [norm(r.name), r]));
  // Two-word aliases for matching inside cafe names and site text: "ritual coffee", "four barrel", "cat cloud".
  const aliasOf = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((w) => w !== "the").slice(0, 2).join(" ");
  const roasterAliases = roasters.map((r) => ({ id: r.id, name: r.name, alias: aliasOf(r.name), origin: r.website ? new URL(r.website).origin.replace(/^https?:\/\/(www\.)?/, "") : null }));
  const ownerOf = (cafeName: string, website: string | null): string | null => {
    const n = ` ${aliasOf(cafeName)} ${cafeName.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
    const host = website ? website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;
    for (const ra of roasterAliases) {
      if (ra.origin && host && host === ra.origin) return ra.id;
      if (ra.alias.length >= 6 && n.includes(` ${ra.alias} `)) return ra.id;
    }
    return null;
  };

  // ---------------------------------------------------------- 1. base cafes from OSM
  const osm = (await fetchOsmCafes(LAT, LNG, RADIUS_M)).filter((c) => !isChain(c.name));
  const cafes = new Map<string, CafeRow>();
  for (const c of osm) {
    const slug = slugify(`${c.name} ${c.city ?? ""}`.trim());
    if (cafes.has(slug)) continue;
    const own = roasterByNorm.get(norm(c.name)) ?? null;
    const ownerId = own?.id ?? ownerOf(c.name, c.website);
    cafes.set(slug, {
      slug, name: c.name, lat: c.lat, lng: c.lng, address_line1: c.address_line1, city: c.city, region: "CA", postal_code: c.postal_code,
      website: c.website, instagram: c.instagram, phone: c.phone, hours: c.hours ? { osm: c.hours } : null, osm_id: c.osm_id,
      roaster_id: ownerId, has_espresso: null, has_pourover: null, has_batch_brew: null, is_multi_roaster: null,
      source: "osm", source_url: `https://www.openstreetmap.org/${c.osm_id}`,
    });
  }
  console.log(`OSM: ${osm.length} non-chain cafes within ${RADIUS_M / 1000} km`);

  const links: Link[] = [];
  const nearbyByName = (name: string, at: { lat: number; lng: number } | null, city: string | null): CafeRow | null => {
    const n = norm(name);
    let best: CafeRow | null = null, bestScore = 0;
    for (const c of cafes.values()) {
      const cn = norm(c.name);
      const nameOk = cn === n || (n.length > 4 && (cn.includes(n) || n.includes(cn)));
      if (!nameOk) continue;
      let score = cn === n ? 2 : 1;
      if (at) {
        const d = distM(at, c);
        if (d > 1500) continue;
        score += d < 200 ? 2 : 1;
      } else if (city && c.city && norm(city) !== norm(c.city)) continue;
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return best;
  };

  // ---------------------------------------------------------- 2. roaster stockist pages
  const stockistReport: { roaster: string; url: string | null; rows: number; matched: number; added: number; outside: number }[] = [];
  if (!flag("--skip-stockists")) {
    for (const r of roasters) {
      if (!r.website) continue;
      const rep = { roaster: r.name, url: null as string | null, rows: 0, matched: 0, added: 0, outside: 0 };
      try {
        const page = await findStockistPage(r.website);
        if (page) {
          rep.url = page.url;
          const rows: Stockist[] = await extractStockists(r.name, page.url, page.text);
          rep.rows = rows.length;
          for (const s of rows) {
            if (s.kind === "grocery" || s.kind === "other") continue;
            if (s.state && s.state.toUpperCase() !== "CA") { rep.outside++; continue; }
            let at: { lat: number; lng: number } | null = null;
            if (s.address || s.city) {
              const hit = await geocodeAddress([s.address, s.city, s.state ?? "CA"].filter(Boolean).join(", "));
              if (hit) at = { lat: hit.lat, lng: hit.lng };
            }
            if (at && distM(at, { lat: LAT, lng: LNG }) > RADIUS_M * 2.5) { rep.outside++; continue; }
            let cafe = nearbyByName(s.name, at, s.city);
            if (!cafe && at) {
              // New cafe we only know from the roaster's page.
              const slug = slugify(`${s.name} ${s.city ?? ""}`.trim());
              cafe = cafes.get(slug) ?? null;
              if (!cafe) {
                cafe = { slug, name: s.name, lat: at.lat, lng: at.lng, address_line1: s.address, city: s.city, region: "CA", postal_code: null, website: null, instagram: null, phone: null, hours: null, osm_id: null, roaster_id: s.kind === "roaster_own_cafe" ? r.id : null, has_espresso: null, has_pourover: null, has_batch_brew: null, is_multi_roaster: null, source: "roaster_site", source_url: page.url };
                cafes.set(slug, cafe);
                rep.added++;
              }
            }
            if (!cafe) continue;
            rep.matched++;
            if (s.kind === "roaster_own_cafe") cafe.roaster_id = r.id;
            links.push({ cafe_slug: cafe.slug, roaster_id: r.id, relationship: s.kind === "roaster_own_cafe" ? "owns" : "serves", source: "roaster_site", source_url: page.url, confidence: at ? 0.9 : 0.7 });
          }
        }
      } catch (e) {
        console.log(`  ! ${r.name}: ${e instanceof Error ? e.message : e}`);
      }
      stockistReport.push(rep);
      console.log(`stockists ${r.name.padEnd(30)} ${rep.url ? "page" : "none"}  rows=${rep.rows} matched=${rep.matched} added=${rep.added} outside=${rep.outside}`);
    }
  }

  // ---------------------------------------------------------- 3. cafe websites
  let scanned = 0, siteLinks = 0;
  if (!flag("--skip-sites")) {
    for (const cafe of cafes.values()) {
      if (!cafe.website) continue;
      const text = (await fetchText(cafe.website)).slice(0, 40000);
      if (!text) continue;
      scanned++;
      const attrs = brewAttrs(text);
      cafe.has_espresso = attrs.has_espresso;
      cafe.has_pourover = attrs.has_pourover;
      cafe.has_batch_brew = attrs.has_batch_brew;
      const nt = ` ${text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
      for (const ra of roasterAliases) {
        if (ra.alias.length < 6) continue;
        if (!nt.includes(` ${ra.alias} `)) continue;
        if (links.some((l) => l.cafe_slug === cafe.slug && l.roaster_id === ra.id)) continue;
        if (cafe.roaster_id === ra.id) continue;
        links.push({ cafe_slug: cafe.slug, roaster_id: ra.id, relationship: "serves", source: "cafe_site", source_url: cafe.website, confidence: 0.6 });
        siteLinks++;
      }
    }
  }
  console.log(`sites: scanned ${scanned}, found ${siteLinks} roaster mentions`);
  for (const c of cafes.values()) {
    const n = links.filter((l) => l.cafe_slug === c.slug && l.relationship === "serves").length;
    if (n >= 2) c.is_multi_roaster = true;
  }

  // ---------------------------------------------------------- 4. write
  const linked = new Set(links.map((l) => l.cafe_slug));
  const rows = [...cafes.values()];
  writeFileSync("data/cafes-report.json", JSON.stringify({ center: [LAT, LNG], radius_m: RADIUS_M, cafes: rows.length, linked: linked.size, links, stockists: stockistReport }, null, 2));
  console.log(`cafes: ${rows.length} total, ${linked.size} linked to a roaster, ${links.length} links`);
  if (!db) return;

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((c) => ({
      slug: c.slug, name: c.name, location: `SRID=4326;POINT(${c.lng} ${c.lat})`, address_line1: c.address_line1, city: c.city, region: c.region,
      postal_code: c.postal_code, country_code: "US", website: c.website, instagram: c.instagram, phone: c.phone, hours: c.hours, osm_id: c.osm_id,
      roaster_id: c.roaster_id, has_espresso: c.has_espresso, has_pourover: c.has_pourover, has_batch_brew: c.has_batch_brew, is_multi_roaster: c.is_multi_roaster,
      curation_tier: linked.has(c.slug) || c.roaster_id ? 1 : 0, source: c.source, source_url: c.source_url, attributes_updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("cafes").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`upsert cafes: ${error.message}`);
  }
  const recomputed = [flag("--skip-sites") ? null : "cafe_site", flag("--skip-stockists") ? null : "roaster_site"].filter((x): x is string => !!x);
  if (recomputed.length) {
    const { error: delErr } = await db.from("cafe_roasters").delete().in("source", recomputed);
    if (delErr) throw new Error(`clear links: ${delErr.message}`);
  }
  const { data: ids, error: idErr } = await db.from("cafes").select("id, slug").in("slug", [...linked]);
  if (idErr) throw new Error(idErr.message);
  const idBySlug = new Map((ids ?? []).map((c) => [c.slug, c.id]));
  const linkRows = links
    .filter((l) => idBySlug.has(l.cafe_slug))
    .map((l) => ({ cafe_id: idBySlug.get(l.cafe_slug)!, roaster_id: l.roaster_id, relationship: l.relationship, source: l.source, source_url: l.source_url, confidence: l.confidence, last_seen_at: new Date().toISOString() }));
  const seen = new Set<string>();
  const dedup = linkRows.filter((l) => { const k = `${l.cafe_id}:${l.roaster_id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (dedup.length) {
    const { error } = await db.from("cafe_roasters").upsert(dedup, { onConflict: "cafe_id,roaster_id" });
    if (error) throw new Error(`upsert links: ${error.message}`);
  }
  console.log(`wrote ${rows.length} cafes and ${dedup.length} links`);
}

main().catch((e) => { console.error(e); process.exit(1); });
