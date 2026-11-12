/**
 * Does a roaster or cafe slug exist? Asked by Proxy before a detail page renders, because a page that
 * finds out inside <Suspense> has already sent a 200 (see the Next docs on streaming status codes).
 *
 * The whole slug list is small, so each server instance keeps it in memory and refreshes it every few
 * minutes; a slug missing from the list is checked on its own before we call it unknown, so a place
 * added since the last refresh is never a 404. Any lookup failure counts as "exists": an outage must
 * not turn real pages into 404s, and the page's own notFound() still covers that case.
 */
export type SlugKind = "roasters" | "cafes";

const LIST_TTL = 5 * 60_000;
const RETRY_AFTER_FAILURE = 30_000;
const MISS_TTL = 60_000;
const MAX_MISSES = 500;
const SLUG_RE = /^[a-z0-9-]+$/;

const lists: Record<SlugKind, { slugs: Set<string>; fresh_until: number }> = {
  roasters: { slugs: new Set(), fresh_until: 0 },
  cafes: { slugs: new Set(), fresh_until: 0 },
};
const misses = new Map<string, number>();

async function rest(query: string): Promise<{ slug: string }[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as { slug: string }[]) : null;
  } catch {
    return null;
  }
}

export async function slugExists(kind: SlugKind, slug: string): Promise<boolean> {
  if (!SLUG_RE.test(slug)) return false; // every slug we mint is kebab-case
  const now = Date.now();
  const list = lists[kind];
  if (now >= list.fresh_until) {
    const rows = await rest(`${kind}?select=slug`);
    if (rows) {
      list.slugs = new Set(rows.map((r) => r.slug));
      list.fresh_until = now + LIST_TTL;
    } else {
      list.fresh_until = now + RETRY_AFTER_FAILURE;
    }
  }
  if (list.slugs.has(slug)) return true;

  const key = `${kind}/${slug}`;
  const missedAt = misses.get(key);
  if (missedAt && now - missedAt < MISS_TTL) return false;
  const rows = await rest(`${kind}?select=slug&slug=eq.${slug}&limit=1`);
  if (!rows) return true;
  if (rows.length > 0) {
    list.slugs.add(slug);
    return true;
  }
  if (misses.size >= MAX_MISSES) misses.clear();
  misses.set(key, now);
  return false;
}
