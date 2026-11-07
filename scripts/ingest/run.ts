/**
 * Roaster ingestion: seed list -> Shopify menu -> attributes -> Supabase.
 *
 *   npx tsx scripts/ingest/run.ts data/roasters.fremont.json [--dry-run] [--only "Name"]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./env";
import { detectShopify, fetchShopifyProducts, stripHtml } from "./shopify";
import { fetchSquarespaceProducts, fetchWooProducts } from "./platforms";
import { isCoffeeProduct, rollupRoaster, toCoffeeRecord } from "./classify";
import { geocodeCity } from "./geocode";
import { enrichRoaster } from "./llm";
import { serviceClient, upsertCoffees, upsertRoaster } from "./db";
import type { CoffeeRecord, RoasterSeed } from "./types";

loadEnv();

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? "data/roasters.fremont.json";
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

async function fetchSiteText(website: string): Promise<string> {
  try {
    const res = await fetch(website, { headers: { "user-agent": "rate-coffee-ingest/0.1" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return "";
    return stripHtml(await res.text()).slice(0, 20000);
  } catch {
    return "";
  }
}

type Report = {
  name: string;
  platform: string;
  shopify: boolean;
  products: number;
  coffees: number;
  roast_level: string | null;
  process_focus: string | null;
  single_origin_share: number | null;
  llm: string | null;
  geo: boolean;
  error?: string;
  sample: string[];
  /** Full coffee list, dry-run only, for tuning the classifier. */
  coffees_detail?: { name: string; status: string; blend: boolean; origin: string | null; process: string | null; roast: string | null; size: number | null; notes: string[] }[];
  rejected?: string[];
};

async function main() {
  const seeds = JSON.parse(readFileSync(file, "utf8")) as RoasterSeed[];
  const db = dryRun ? null : serviceClient();
  const report: Report[] = [];

  for (const seed of seeds) {
    if (only && !seed.name.toLowerCase().includes(only.toLowerCase())) continue;
    const r: Report = { name: seed.name, platform: "none", shopify: false, products: 0, coffees: 0, roast_level: null, process_focus: null, single_origin_share: null, llm: null, geo: false, sample: [] };
    try {
      const shopOrigin = (await detectShopify(seed.shop_url ?? seed.website)) ?? (seed.shop_url ? await detectShopify(seed.website) : null);
      let coffees: CoffeeRecord[] = [];
      let products = null as import("./types").RawProduct[] | null;
      if (shopOrigin) {
        r.shopify = true;
        r.platform = "shopify";
        products = await fetchShopifyProducts(shopOrigin);
      } else {
        products = await fetchWooProducts(seed.website);
        if (products) r.platform = "woocommerce";
        else {
          products = await fetchSquarespaceProducts(seed.website);
          if (products) r.platform = "squarespace";
        }
      }
      if (products) {
        r.products = products.length;
        coffees = products.filter(isCoffeeProduct).map(toCoffeeRecord);
        if (dryRun) {
          r.coffees_detail = coffees.map((c) => ({ name: c.name, status: c.status, blend: c.is_blend, origin: c.origin_country_code, process: c.process_family, roast: c.roast_level, size: c.size_grams, notes: c.tasting_notes }));
          r.rejected = products.filter((p) => !isCoffeeProduct(p)).map((p) => `${p.title} <${p.product_type}>`);
        }
      }
      const siteText = coffees.length ? "" : await fetchSiteText(seed.website);
      const attrs = rollupRoaster(coffees, siteText);
      const enrichment = await enrichRoaster(seed.name, seed.website, coffees, attrs);
      if (enrichment) {
        r.llm = `${enrichment.confidence}${enrichment.is_specialty ? "" : " not-specialty"}`;
        if (enrichment.confidence !== "low") {
          attrs.roast_level = enrichment.roast_level ?? attrs.roast_level;
          attrs.process_focus = enrichment.process_focus ?? attrs.process_focus;
        }
        attrs.description = enrichment.description;
      }
      r.coffees = coffees.length;
      r.roast_level = attrs.roast_level;
      r.process_focus = attrs.process_focus;
      r.single_origin_share = attrs.single_origin_share;
      r.sample = coffees.slice(0, 3).map((c) => `${c.name} [${c.origin_country_code ?? (c.is_blend ? "blend" : "?")}/${c.process_family ?? "?"}/${c.roast_level ?? "?"}]`);

      const geo = await geocodeCity(seed.city, seed.state ?? "CA", seed.country_code ?? "US");
      r.geo = !!geo;

      if (db) {
        const roasterId = await upsertRoaster(db, seed, attrs, geo, shopOrigin, attrs.description, r.platform);
        await upsertCoffees(db, roasterId, coffees, r.platform);
      }
    } catch (err) {
      r.error = err instanceof Error ? err.message : String(err);
    }
    report.push(r);
    await new Promise((res) => setTimeout(res, 1500));
    console.log(`${r.error ? "✗" : "✓"} ${r.name.padEnd(28)} ${r.platform.padEnd(11)} products=${String(r.products).padStart(3)} coffees=${String(r.coffees).padStart(3)} roast=${(r.roast_level ?? "-").padEnd(12)} process=${(r.process_focus ?? "-").padEnd(12)} so=${r.single_origin_share ?? "-"}${r.error ? `  ERROR ${r.error}` : ""}`);
  }
  writeFileSync("data/ingest-report.json", JSON.stringify(report, null, 2));
  console.log(`\nwrote data/ingest-report.json (${report.length} roasters, ${report.filter((x) => x.error).length} errors)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
