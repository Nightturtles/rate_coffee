import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, PenLine } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { PROCESS_FOCUS_LABEL, PROCESS_LABEL, ROAST_LABEL, money, pct } from "@/lib/labels";
import { btn } from "@/lib/ui";
import { fetchCheckIns } from "@/lib/checkins";
import { Chip } from "@/components/ui/Chip";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { DataError } from "@/components/ui/DataError";
import { CheckInList } from "@/components/CheckInList";

type CoffeeRow = {
  id: string; name: string; url: string | null; is_blend: boolean; roast_level: string | null; origin_country_code: string | null;
  process: string | null; process_family: string | null; varieties: string[]; tasting_notes: string[]; price_cents: number | null; size_grams: number | null; status: string;
};
type CafeRef = { name: string; slug: string; city: string | null };

const ext = "inline-flex items-center gap-1 label text-text transition hover:text-muted";

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
  const [{ data: score }, { data: coffees }, { data: served }, { data: ownCafes }, checkIns] = await Promise.all([
    db.from("roaster_scores").select("specialty_score, active_coffee_count, check_in_count, rating").eq("roaster_id", r.id).maybeSingle(),
    db.from("coffees").select("id, name, url, is_blend, roast_level, origin_country_code, process, process_family, varieties, tasting_notes, price_cents, size_grams, status").eq("roaster_id", r.id).order("status").order("name"),
    db.from("cafe_roasters").select("relationship, cafes(name, slug, city)").eq("roaster_id", r.id),
    db.from("cafes").select("name, slug, city").eq("roaster_id", r.id).order("name"),
    fetchCheckIns(db, { roasterId: r.id }, 10).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
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
  const meta = [
    [r.city, r.region].filter(Boolean).join(", "),
    score?.check_in_count ? `${score.check_in_count} check-in${score.check_in_count === 1 ? "" : "s"}${score.check_in_count >= 3 ? ` · ${Number(score.rating).toFixed(1)} avg` : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <Link href="/roasters" className="label transition hover:text-text">← Roasters</Link>
      <div className="mt-8 flex items-start gap-6">
        <ScoreBadge score={score?.specialty_score} size="lg" />
        <div className="min-w-0 pt-1">
          <h1 className="text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">{r.name}</h1>
          <p className="mt-3 text-muted">{meta}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {r.roast_level && <Chip tone={r.roast_level.includes("light") ? "bronze" : "default"}>{ROAST_LABEL[r.roast_level]}</Chip>}
        {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
        {r.single_origin_share != null && <Chip>{pct(r.single_origin_share)} single origin</Chip>}
        {[...origins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, n]) => <Chip key={code}>{code} ×{n}</Chip>)}
      </div>
      {r.description && <p className="mt-8 max-w-2xl text-[17px] leading-relaxed">{r.description}</p>}
      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Link href={`/log?roaster=${slug}`} className={btn}><PenLine size={14} strokeWidth={1.6} /> Log a coffee</Link>
        {r.website && <a className={ext} href={r.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={12} /></a>}
        {r.shop_url && r.shop_url !== r.website && <a className={ext} href={r.shop_url} target="_blank" rel="noreferrer">Shop <ArrowUpRight size={12} /></a>}
        {r.instagram && <a className={ext} href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noreferrer">@{r.instagram} <ArrowUpRight size={12} /></a>}
      </div>

      {where.length > 0 && (
        <section className="mt-16">
          <p className="label border-b border-border pb-3">Where to find it · {where.length}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {where.map(({ cafe, owns }) => (
              <li key={cafe.slug}>
                <Link href={`/cafes/${cafe.slug}`} className={`inline-flex items-center gap-1 rounded-[2px] border px-3 py-1.5 text-sm transition hover:border-text ${owns ? "border-text" : "border-border"}`}>
                  {cafe.name}{cafe.city ? <span className="text-muted">, {cafe.city}</span> : null}
                  {owns && <span className="label ml-1 text-[9px]">Own</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16">
        <p className="label border-b border-border pb-3">On the menu · {active.length}</p>
        <CoffeeList rows={active} slug={slug} />
        {past.length > 0 && (
          <details className="mt-8">
            <summary className="label cursor-pointer text-text">Past coffees · {past.length}</summary>
            <CoffeeList rows={past} slug={slug} />
          </details>
        )}
      </section>

      <section className="mt-16">
        <p className="label border-b border-border pb-3">Recent check-ins</p>
        {checkIns instanceof Error ? <DataError error={checkIns} what="check-ins" /> : <CheckInList rows={checkIns} context="roaster" emptyText="No one has logged this roaster yet. Be the first." />}
      </section>
      {r.attributes_updated_at && <p className="label mt-16">Menu refreshed {new Date(r.attributes_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
    </>
  );
}

function CoffeeList({ rows, slug }: { rows: CoffeeRow[]; slug: string }) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-muted">Nothing found.</p>;
  return (
    <ul>
      {rows.map((c, i) => (
        <li key={c.id} className="flex gap-5 border-b border-border py-4">
          <span className="num w-6 shrink-0 pt-0.5 text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">
                {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-transparent underline-offset-4 transition hover:decoration-text">{c.name}</a> : c.name}
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="num text-[12px] text-muted">{money(c.price_cents)}{c.size_grams ? ` · ${c.size_grams}g` : ""}</span>
                <Link href={`/log?roaster=${slug}&coffee=${c.id}`} className="label text-text transition hover:text-muted">Log</Link>
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {[c.is_blend ? "Blend" : c.origin_country_code, c.process ?? (c.process_family ? PROCESS_LABEL[c.process_family] : null), c.roast_level ? ROAST_LABEL[c.roast_level] : null, c.varieties.length ? c.varieties.join(", ") : null].filter(Boolean).join(" · ")}
            </p>
            {c.tasting_notes.length > 0 && <p className="mt-0.5 text-sm text-muted">{c.tasting_notes.join(", ")}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RoasterPage({ params }: PageProps<"/roasters/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <RoasterDetail params={params} />
      </Suspense>
    </main>
  );
}
