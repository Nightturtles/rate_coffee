import type { RawProduct } from "./types";

const UA = "rate-coffee-ingest/0.1 (catalog research; contact via site)";

type ShopifyVariant = { price?: string; grams?: number; available?: boolean; title?: string };
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  tags?: string[] | string;
  body_html?: string;
  images?: { src: string }[];
  variants?: ShopifyVariant[];
  published_at?: string | null;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON with retry on 429/5xx (Shopify rate-limits bursts of products.json calls). */
async function fetchJson(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after")) || 0;
        await sleep(Math.max(ra * 1000, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

/** Returns the Shopify origin (with scheme, no path) if the site exposes products.json. */
export async function detectShopify(website: string): Promise<string | null> {
  const origin = new URL(website).origin;
  const probe = await fetchJson(`${origin}/products.json?limit=1`);
  if (probe && typeof probe === "object" && Array.isArray((probe as { products?: unknown }).products)) {
    return origin;
  }
  return null;
}

function pickWeight(variant: ShopifyVariant): number | null {
  if (variant.grams && variant.grams > 0) return Math.round(variant.grams);
  const t = (variant.title ?? "").toLowerCase();
  const oz = t.match(/(\d+(?:\.\d+)?)\s*oz/);
  if (oz) return Math.round(parseFloat(oz[1]) * 28.3495);
  const g = t.match(/(\d{2,4})\s*g\b/);
  if (g) return parseInt(g[1], 10);
  const lb = t.match(/(\d+(?:\.\d+)?)\s*lb/);
  if (lb) return Math.round(parseFloat(lb[1]) * 453.592);
  return null;
}

/** Pulls every product from a Shopify store's public feed. */
export async function fetchShopifyProducts(origin: string): Promise<RawProduct[]> {
  const out: RawProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = (await fetchJson(`${origin}/products.json?limit=250&page=${page}`)) as
      | { products?: ShopifyProduct[] }
      | null;
    const products = data?.products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const variants = p.variants ?? [];
      const prices = variants.map((v) => parseFloat(v.price ?? "")).filter((n) => Number.isFinite(n));
      const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      const sizes = variants.map(pickWeight).filter((n): n is number => n != null);
      out.push({
        external_id: String(p.id),
        title: p.title.trim(),
        handle: p.handle,
        url: `${origin}/products/${p.handle}`,
        product_type: p.product_type ?? "",
        tags,
        body_text: stripHtml(p.body_html ?? ""),
        image_url: p.images?.[0]?.src ?? null,
        price_cents: prices.length ? Math.round(Math.min(...prices) * 100) : null,
        size_grams: sizes.length ? Math.min(...sizes) : null,
        available: variants.some((v) => v.available !== false),
        published_at: p.published_at ?? null,
      });
    }
    if (products.length < 250) break;
  }
  return out;
}
