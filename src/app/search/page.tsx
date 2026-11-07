import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/SearchBox";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const metadata = { title: "Search" };

type Hit = { kind: "roaster" | "cafe" | "coffee"; id: string; slug: string; name: string; subtitle: string; rank: number };

async function Results({ q }: { q: string }) {
  if (!q) return <p className="mt-6 text-muted">Type a roaster, cafe, or coffee name.</p>;
  const db = createSupabasePublicClient();
  const { data, error } = await db.rpc("search_catalog", { q, lim: 40 });
  if (error) return <p className="mt-6 text-red-500">{error.message}</p>;
  const hits = (data ?? []) as Hit[];
  if (hits.length === 0) return <p className="mt-6 text-muted">Nothing matched &ldquo;{q}&rdquo;.</p>;
  const groups: Record<Hit["kind"], Hit[]> = { roaster: [], cafe: [], coffee: [] };
  for (const h of hits) groups[h.kind].push(h);
  const label = { roaster: "Roasters", cafe: "Cafes", coffee: "Coffees" };
  const hrefFor = (h: Hit) => (h.kind === "roaster" ? `/roasters/${h.slug}` : `/cafes/${h.slug}`);
  return (
    <div className="mt-6 space-y-8">
      {(["roaster", "cafe", "coffee"] as const).map((k) =>
        groups[k].length ? (
          <section key={k}>
            <h2 className="text-lg font-semibold">{label[k]}</h2>
            <ul className="mt-2 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
              {groups[k].map((h) => (
                <li key={h.id}>
                  {k === "coffee" ? (
                    <CoffeeHit h={h} />
                  ) : (
                    <Link href={hrefFor(h)} className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="font-medium">{h.name}</span>
                      <span className="text-sm text-muted">{h.subtitle}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

async function CoffeeHit({ h }: { h: Hit }) {
  // Coffee search hits carry the roaster name as subtitle; link to the roaster page.
  const db = createSupabasePublicClient();
  const { data } = await db.from("coffees").select("roasters(slug)").eq("id", h.id).maybeSingle();
  const slug = (data?.roasters as unknown as { slug: string } | null)?.slug;
  return (
    <Link href={slug ? `/roasters/${slug}` : "/roasters"} className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-surface-2">
      <span className="font-medium">{h.name}</span>
      <span className="shrink-0 text-sm text-muted">{h.subtitle}</span>
    </Link>
  );
}

async function SearchPageInner({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <div className="mt-4">
        <SearchBox defaultValue={q} />
      </div>
      <Suspense fallback={<p className="mt-6 text-muted">Searching…</p>}>
        <Results q={q} />
      </Suspense>
    </main>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8 text-muted">Loading…</main>}>
      <SearchPageInner searchParams={searchParams} />
    </Suspense>
  );
}
