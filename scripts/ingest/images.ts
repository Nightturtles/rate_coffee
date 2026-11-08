/**
 * Imagery: find a hero image (and a logo) for each roaster and cafe from its own site.
 *
 *   npx tsx scripts/ingest/images.ts [--dry-run] [--only slug] [--cafes-only|--roasters-only]
 *
 * Hero preference, in order:
 *   1. og:image, when it is a real photo (declared >= 800px wide, not a logo/icon/sticker)
 *   2. the largest <img> on the homepage (srcset max >= 1000px) that is not a logo
 *   3. roasters only: the first active coffee's product photo (already in `coffees.image_url`)
 * Writes data/images-report.json so the picks can be eyeballed before (or after) applying.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./env";
import { serviceClient } from "./db";

loadEnv();

const UA = "Mozilla/5.0 (compatible; rate-coffee-ingest/0.1; catalog research)";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const cafesOnly = args.includes("--cafes-only");
const roastersOnly = args.includes("--roasters-only");

/** data/image-overrides.json: slug -> image URL, "coffee" (force the product-photo fallback), or null (no image). */
const OVERRIDES: Record<string, string | null> = existsSync("data/image-overrides.json") ? JSON.parse(readFileSync("data/image-overrides.json", "utf8")) : {};

type Pick = { url: string; width: number | null; source: "og" | "hero_img" | "coffee" };
type Scrape = { og: { url: string; width: number | null; height: number | null } | null; logo: string | null; imgs: { url: string; width: number }[] };

const LOGO_RE = /logo|brand|icon|favicon|sticker|badge|wordmark|placeholder|pixel|spinner|loading/i;

function absolute(src: string, base: string): string | null {
  try {
    const s = src.trim().replace(/&amp;/g, "&");
    if (!s || s.startsWith("data:")) return null;
    const u = new URL(s.startsWith("//") ? `https:${s}` : s, base);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.href;
  } catch {
    return null;
  }
}

type Probe = { ok: boolean; type: string | null; width: number | null; height: number | null };
const probeCache = new Map<string, Promise<Probe>>();

/** Reads the first 64KB of an image and parses its dimensions (PNG, JPEG, WebP, GIF). */
function probe(url: string): Promise<Probe> {
  if (!probeCache.has(url)) {
    probeCache.set(url, (async (): Promise<Probe> => {
      try {
        const res = await fetch(url, { headers: { "user-agent": UA, range: "bytes=0-65535", accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
        const type = res.headers.get("content-type")?.split(";")[0].trim() ?? null;
        if (!res.ok || !type?.startsWith("image/")) return { ok: false, type, width: null, height: null };
        const buf = Buffer.from(await res.arrayBuffer());
        const dims = parseDims(buf);
        return { ok: true, type, width: dims?.width ?? null, height: dims?.height ?? null };
      } catch {
        return { ok: false, type: null, width: null, height: null };
      }
    })());
  }
  return probeCache.get(url)!;
}

function parseDims(b: Buffer): { width: number; height: number } | null {
  if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") { const bits = b.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** Shopify and Squarespace embed the requested size in the URL; strip it so we probe (and store) the original. */
function original(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("cdn.shopify.com") || u.pathname.includes("/cdn/shop/")) {
      for (const k of ["width", "height", "crop", "pad_color"]) u.searchParams.delete(k);
      u.pathname = u.pathname.replace(/_(?:\{width\}|%7Bwidth%7D)x/gi, "").replace(/_(\d{2,5})x(\d{0,5})(?:_crop_\w+)?(\.[a-z0-9]+)$/i, "$3").replace(/_(\d{2,5})x(\d{0,5})@\dx(\.[a-z0-9]+)$/i, "$3");
    } else if (u.hostname.endsWith("squarespace-cdn.com") || u.hostname.endsWith("squarespace.com")) {
      u.searchParams.delete("format");
    }
    return u.href;
  } catch {
    return url;
  }
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/** Largest width advertised by an <img>: srcset descriptors, width attr, or a ?width= query. */
function imgWidth(tag: string, src: string): number {
  let w = 0;
  const srcset = attr(tag, "srcset") ?? attr(tag, "data-srcset");
  if (srcset) for (const m of srcset.matchAll(/\s(\d{2,5})w/g)) w = Math.max(w, Number(m[1]));
  const wa = Number(attr(tag, "width"));
  if (Number.isFinite(wa)) w = Math.max(w, wa);
  const q = src.match(/[?&](?:width|w)=(\d{2,5})/)?.[1] ?? src.match(/[?&]format=(\d{2,5})w/)?.[1] ?? src.match(/_(\d{3,5})x(?:\d{0,5})?\./)?.[1];
  if (q) w = Math.max(w, Number(q));
  return w;
}

async function scrape(site: string): Promise<Scrape | null> {
  let html: string, base: string;
  try {
    const res = await fetch(site, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    base = res.url || site;
    html = (await res.text()).slice(0, 1_500_000);
  } catch {
    return null;
  }
  const head = html; // Shopify heads can run past 200KB of inline script, so search it all
  const meta = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"));
    return m ? attr(m[0], "content") : null;
  };
  const ogUrl = meta("og:image:secure_url") ?? meta("og:image") ?? meta("twitter:image");
  const og = ogUrl && absolute(ogUrl, base) ? { url: original(absolute(ogUrl, base)!), width: Number(meta("og:image:width")) || null, height: Number(meta("og:image:height")) || null } : null;

  let logo: string | null = null;
  const imgs: { url: string; width: number }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const rawSrc = attr(tag, "src") ?? attr(tag, "data-src") ?? (attr(tag, "srcset") ?? attr(tag, "data-srcset"))?.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
    if (!rawSrc) continue;
    const src0 = absolute(rawSrc, base);
    if (!src0) continue;
    const src = original(src0);
    const desc = `${attr(tag, "class") ?? ""} ${attr(tag, "alt") ?? ""} ${attr(tag, "id") ?? ""} ${src}`;
    if (LOGO_RE.test(desc)) {
      if (!logo && /logo|brand|wordmark/i.test(desc) && !/svg\+xml|payment|partner|press/i.test(desc)) logo = src;
      continue;
    }
    if (/\.svg(\?|$)/i.test(src)) continue;
    imgs.push({ url: src, width: imgWidth(tag, src) });
  }
  if (!logo) {
    const touch = head.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i)?.[0];
    const href = touch ? attr(touch, "href") : null;
    if (href) logo = absolute(href, base);
  }
  imgs.sort((a, b) => b.width - a.width);
  return { og, logo, imgs };
}

const BAD_RE = /no-image|placeholder|\/ads?\/|promo|sale|black-friday|thanksgiving|holiday|gift-?card|giftcard|subscription|newsletter|payment|map|qr/i;
const GOOD_RE = /hero|banner|home|cafe|shop|roast|bar|interior|store|front|cup|espresso|brew/i;

/** Probe the top candidates and keep the best-looking photo. Logos and seasonal banners lose. */
async function chooseHero(s: Scrape | null, coffeeImage: string | null, slug?: string): Promise<{ pick: Pick | null; rejected: string[] }> {
  const rejected: string[] = [];
  if (slug && slug in OVERRIDES) {
    const o = OVERRIDES[slug];
    if (o === null) return { pick: null, rejected };
    if (o !== "coffee") return { pick: { url: o, width: null, source: "og" }, rejected };
    return { pick: coffeeImage ? { url: coffeeImage, width: null, source: "coffee" } : null, rejected };
  }
  const cands: { url: string; source: Pick["source"] }[] = [];
  if (s?.og) cands.push({ url: s.og.url, source: "og" });
  for (const i of s?.imgs.slice(0, 8) ?? []) if (i.width >= 500 && !cands.some((c) => c.url === i.url)) cands.push({ url: i.url, source: "hero_img" });
  let best: { score: number; pick: Pick } | null = null;
  for (const c of cands) {
    if (BAD_RE.test(c.url) || LOGO_RE.test(c.url)) { rejected.push(c.url); continue; }
    const p = await probe(c.url);
    if (!p.ok || !p.width || !p.height) { rejected.push(c.url); continue; }
    const ratio = p.width / p.height;
    if (p.width < (c.source === "og" ? 800 : 1000) || p.height < 400 || ratio < 0.7 || ratio > 2.6) { rejected.push(`${c.url} (${p.width}x${p.height})`); continue; }
    let score = 0;
    if (p.type === "image/jpeg" || p.type === "image/webp") score += 2; // photos, not artwork
    if (p.type === "image/png" || p.type === "image/gif") score -= 1;
    if (p.width >= 1400) score += 1;
    if (ratio >= 1.2 && ratio <= 2.0) score += 1;
    if (c.source === "og") score += 1;
    if (GOOD_RE.test(c.url)) score += 1;
    if (!best || score > best.score) best = { score, pick: { url: c.url, width: p.width, source: c.source } };
  }
  if (best && best.score >= 2) return { pick: best.pick, rejected };
  if (coffeeImage) {
    const p = await probe(coffeeImage);
    if (p.ok) return { pick: { url: coffeeImage, width: p.width, source: "coffee" }, rejected };
  }
  if (best) return { pick: best.pick, rejected };
  return { pick: null, rejected };
}

type Row = { kind: "roaster" | "cafe"; slug: string; name: string; website: string | null; hero: Pick | null; logo: string | null; rejected?: string[] };

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

async function main() {
  const db = serviceClient();
  const report: Row[] = [];

  if (!cafesOnly) {
    const { data: roasters, error } = await db.from("roasters").select("id, slug, name, website, shop_url").neq("status", "closed").order("name");
    if (error) throw new Error(error.message);
    const { data: coffees } = await db.from("coffees").select("roaster_id, image_url, name").eq("status", "active").not("image_url", "is", null).order("name");
    const firstCoffee = new Map<string, string>();
    for (const c of coffees ?? []) if (!firstCoffee.has(c.roaster_id)) firstCoffee.set(c.roaster_id, c.image_url as string);

    const rows = await mapLimit((roasters ?? []).filter((r) => !only || r.slug === only), 4, async (r) => {
      const site = r.website ?? r.shop_url;
      const s = site ? await scrape(site) : null;
      const { pick: hero, rejected } = await chooseHero(s, firstCoffee.get(r.id) ?? null, r.slug);
      const row: Row = { kind: "roaster", slug: r.slug, name: r.name, website: site, hero, logo: s?.logo ?? null, rejected };
      console.log(`${r.name.padEnd(34)} ${hero ? `${hero.source.padEnd(8)} ${hero.url.slice(0, 90)}` : "—"}`);
      if (!dryRun) {
        const { error: e } = await db.from("roasters").update({ image_url: hero?.url ?? null, logo_url: s?.logo ?? null }).eq("id", r.id);
        if (e) throw new Error(`update roaster ${r.slug}: ${e.message}`);
      }
      return row;
    });
    report.push(...rows);
  }

  if (!roastersOnly) {
    const { data: cafes, error } = await db.from("cafes").select("id, slug, name, website").neq("status", "closed").not("website", "is", null).order("name");
    if (error) throw new Error(error.message);
    const rows = await mapLimit((cafes ?? []).filter((c) => !only || c.slug === only), 4, async (c) => {
      const s = await scrape(c.website as string);
      const { pick: hero, rejected } = await chooseHero(s, null, c.slug);
      const row: Row = { kind: "cafe", slug: c.slug, name: c.name, website: c.website, hero, logo: s?.logo ?? null, rejected };
      console.log(`${c.name.padEnd(34)} ${hero ? `${hero.source.padEnd(8)} ${hero.url.slice(0, 90)}` : "—"}`);
      if (!dryRun && hero) {
        const { error: e } = await db.from("cafes").update({ image_url: hero.url, logo_url: s?.logo ?? null }).eq("id", c.id);
        if (e) throw new Error(`update cafe ${c.slug}: ${e.message}`);
      }
      return row;
    });
    report.push(...rows);
  }

  writeFileSync("data/images-report.json", JSON.stringify(report, null, 2));
  const withHero = report.filter((r) => r.hero).length;
  console.log(`\n${withHero}/${report.length} with a hero image${dryRun ? " (dry run, nothing written)" : ""}. Report: data/images-report.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
