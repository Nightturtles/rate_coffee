import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AtSign, ExternalLink } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { PROCESS_FOCUS_LABEL, PROCESS_LABEL, ROAST_LABEL, money, pct } from "@/lib/labels";
import { Chip } from "@/components/ui/Chip";
import { ScoreBadge } from "@/components/ui/ScoreBadge";

type CoffeeRow = {
  id: string; name: string; url: string | null; is_blend: boolean; roast_level: string | null; origin_country_code: string | null;
  process: string | null; process_family: string | null; varieties: string[]; tasting_notes: string[]; price_cents: number | null; size_grams: number | null; status: string;
};
type CafeRef = { name: string; slug: string; city: string | null };

export async function generateMetadata({ params }: PageProps<"/roasters/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const db = createSupabasePublicClient();
  const { data } = await db.from("roasters").select("name, city, description").eq("slug", slug).maybeSingle();
  if (!data) return { title: "Roaster" };
  return { title: `${data.name}${data.city ? `, ${data.city}` : ""}`, description: data.description ?? undefined };
}

async function RoasterDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createSupabasePublicClient();
  const { data: r } = await db
    .from("roasters")
    .select("id, name, website, shop_url, instagram, description, city, region, roast_level, process_focus, single_origin_share, attributes_updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!r) notFound();
  const [{ data: score }, { data: coffees }, { data: served }, { data: ownCafes }] = await Promise.all([
    db.from("roaster_scores").select("specialty_score, active_coffee_count, check_in_count, rating").eq("roaster_id", r.id).maybeSingle(),
    db.from("coffees").select("id, name, url, is_blend, roast_level, origin_country_code, process, process_family, varieties, tasting_notes, price_cents, size_grams, status").eq("roaster_id", r.id).order("status").order("name"),
    db.from("cafe_roasters").select("relationship, cafes(name, slug, city)").eq("roaster_id", r.id),
    db.from("cafes").select("name, slug, city").eq("roaster_id", r.id).order("name"),
  ]);
  const where: { cafe: CafeRef; owns: boolean }[] = [
    ...((ownCafes ?? []) as CafeRef[]).map((cafe) => ({ cafe, owns: true })),
    ...((served ?? []) as unknown as { relationship: string; cafes: CafeRef | null }[]).filter((l) => l.cafes && l.relationship !== "owns").map((l) => ({ cafe: l.cafes as CafeRef, owns: false })),
  ];
  const rows = (coffees ?? []) as CoffeeRow[];
  const active = rows.filter((c) => c.status === "active");
  const past = rows.filter((c) => c.status !== "active");
  const origins = new Map<string, number>();
  for (const c of active) if (c.origin_country_code) origins.set(c.origin_country_code, (origins.get(c.origin_country_code) ?? 0) + 1);

  return (
    <>
      <Link href="/roasters" className="text-sm text-muted underline-offset-4 hover:underline">← Roasters</Link>
      <div className="mt-3 flex items-start gap-4">
        <ScoreBadge score={score?.specialty_score} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{r.name}</h1>
          <p className="text-muted">{[r.city, r.region].filter(Boolean).join(", ")}{score?.check_in_count ? ` · ${score.check_in_count} check-ins, ${Number(score.rating).toFixed(1)} avg` : ""}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {r.roast_level && <Chip tone={r.roast_level.includes("light") ? "accent" : "default"}>{ROAST_LABEL[r.roast_level]}</Chip>}
        {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
        {r.single_origin_share != null && <Chip>{pct(r.single_origin_share)} single origin</Chip>}
        {[...origins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, n]) => <Chip key={code}>{code} ×{n}</Chip>)}
      </div>
      {r.description && <p className="mt-4 max-w-prose text-[15px] leading-relaxed">{r.description}</p>}
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        {r.website && <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={r.website} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Website</a>}
        {r.shop_url && r.shop_url !== r.website && <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={r.shop_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Shop</a>}
        {r.instagram && <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noreferrer"><AtSign size={14} /> @{r.instagram}</a>}
      </p>

      {where.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Where to find it <span className="text-muted">({where.length})</span></h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {where.map(({ cafe, owns }) => (
              <li key={cafe.slug}>
                <Link href={`/cafes/${cafe.slug}`} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:border-accent ${owns ? "border-accent/40 bg-accent/10" : "border-border bg-surface"}`}>
                  {cafe.name}{cafe.city ? <span className="text-muted">, {cafe.city}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">On the menu <span className="text-muted">({active.length})</span></h2>
        <CoffeeList rows={active} />
        {past.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-muted">Past coffees ({past.length})</summary>
            <CoffeeList rows={past} />
          </details>
        )}
      </section>
      {r.attributes_updated_at && <p className="mt-10 text-xs text-muted">Menu and attributes refreshed {new Date(r.attributes_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.</p>}
    </>
  );
}

function CoffeeList({ rows }: { rows: CoffeeRow[] }) {
  if (rows.length === 0) return <p className="mt-2 text-muted">Nothing found.</p>;
  return (
    <ul className="mt-3 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {rows.map((c) => (
        <li key={c.id} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium">
              {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{c.name}</a> : c.name}
            </span>
            <span className="shrink-0 text-sm text-muted">{money(c.price_cents)}{c.size_grams ? ` · ${c.size_grams}g` : ""}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {[c.is_blend ? "Blend" : c.origin_country_code, c.process ?? (c.process_family ? PROCESS_LABEL[c.process_family] : null), c.roast_level ? ROAST_LABEL[c.roast_level] : null, c.varieties.length ? c.varieties.join(", ") : null].filter(Boolean).join(" · ")}
          </p>
          {c.tasting_notes.length > 0 && <p className="mt-0.5 text-sm italic text-muted">{c.tasting_notes.join(", ")}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function RoasterPage({ params }: PageProps<"/roasters/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <RoasterDetail params={params} />
      </Suspense>
    </main>
  );
}
