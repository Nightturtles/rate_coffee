import type { RawProduct } from "./types";
import { stripHtml } from "./shopify";

const UA = "rate-coffee-ingest/0.1 (catalog research)";

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function centsFrom(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function gramsFromText(s: string): number | null {
  const t = s.toLowerCase();
  const oz = t.match(/(\d+(?:\.\d+)?)\s*oz/);
  if (oz) return Math.round(parseFloat(oz[1]) * 28.3495);
  const g = t.match(/(\d{2,4})\s*g\b/);
  if (g) return parseInt(g[1], 10);
  const lb = t.match(/(\d+(?:\.\d+)?)\s*lb/);
  if (lb) return Math.round(parseFloat(lb[1]) * 453.592);
  return null;
}

// ---------------------------------------------------------------- Squarespace

type SqItem = {
  id: string;
  title: string;
  fullUrl: string;
  urlId?: string;
  excerpt?: string;
  body?: string;
  tags?: string[];
  categories?: string[];
  assetUrl?: string;
  variants?: { price?: number | string; priceMoney?: { value?: string }; attributes?: Record<string, string> }[];
  structuredContent?: { variants?: { price?: number; priceMoney?: { value?: string }; attributes?: Record<string, string> }[]; productType?: number };
  publishOn?: number;
};

/** Squarespace commerce pages answer `?format=json` with their items. Tries the common shop paths. */
export async function fetchSquarespaceProducts(website: string): Promise<RawProduct[] | null> {
  const origin = new URL(website).origin;
  const paths = ["/shop", "/store", "/coffee", "/products", "/shop-coffee", "/beans", "/shop-all", "/buy"];
  for (const path of paths) {
    const data = (await getJson(`${origin}${path}?format=json`)) as { items?: SqItem[]; collection?: { type?: number } } | null;
    const items = data?.items;
    if (!items || !Array.isArray(items) || items.length === 0) continue;
    const out: RawProduct[] = [];
    for (const it of items) {
      const variants = it.structuredContent?.variants ?? it.variants ?? [];
      const prices = variants.map((v) => centsFrom(v.priceMoney?.value ?? v.price)).filter((n): n is number => n != null);
      const sizes = variants
        .map((v) => gramsFromText(Object.values(v.attributes ?? {}).join(" ")))
        .filter((n): n is number => n != null);
      out.push({
        external_id: String(it.id),
        title: it.title.trim(),
        handle: it.urlId ?? it.fullUrl.split("/").pop() ?? it.title,
        url: it.fullUrl.startsWith("http") ? it.fullUrl : `${origin}${it.fullUrl}`,
        product_type: (it.categories ?? []).join(", "),
        tags: it.tags ?? [],
        body_text: stripHtml(`${it.excerpt ?? ""}\n${it.body ?? ""}`),
        image_url: it.assetUrl ?? null,
        price_cents: prices.length ? Math.min(...prices) : null,
        size_grams: sizes.length ? Math.min(...sizes) : null,
        available: true,
        published_at: it.publishOn ? new Date(it.publishOn).toISOString() : null,
      });
    }
    if (out.length) return out;
  }
  return null;
}

// ---------------------------------------------------------------- WooCommerce

type WcProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description?: string;
  short_description?: string;
  is_in_stock?: boolean;
  images?: { src: string }[];
  categories?: { name: string }[];
  tags?: { name: string }[];
  prices?: { price?: string; currency_minor_unit?: number };
  attributes?: { name: string; terms?: { name: string }[] }[];
};

/** WooCommerce exposes a public Store API; no auth needed for the catalog. */
export async function fetchWooProducts(website: string): Promise<RawProduct[] | null> {
  const origin = new URL(website).origin;
  const out: RawProduct[] = [];
  for (let page = 1; page <= 5; page++) {
    const data = (await getJson(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`)) as WcProduct[] | null;
    if (!data || !Array.isArray(data) || data.length === 0) break;
    for (const p of data) {
      const minor = p.prices?.currency_minor_unit ?? 2;
      const raw = p.prices?.price ? parseInt(p.prices.price, 10) : NaN;
      const price = Number.isFinite(raw) ? Math.round(raw / Math.pow(10, minor) * 100) : null;
      const attrText = (p.attributes ?? []).flatMap((a) => (a.terms ?? []).map((t) => t.name)).join(" ");
      out.push({
        external_id: String(p.id),
        title: p.name.trim(),
        handle: p.slug,
        url: p.permalink,
        product_type: (p.categories ?? []).map((c) => c.name).join(", "),
        tags: (p.tags ?? []).map((t) => t.name),
        body_text: stripHtml(`${p.short_description ?? ""}\n${p.description ?? ""}\n${attrText}`),
        image_url: p.images?.[0]?.src ?? null,
        price_cents: price,
        size_grams: gramsFromText(attrText) ?? gramsFromText(p.name),
        available: p.is_in_stock !== false,
        published_at: null,
      });
    }
    if (data.length < 100) break;
  }
  return out.length ? out : null;
}
