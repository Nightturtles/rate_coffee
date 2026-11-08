import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, PenLine } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { PROCESS_FOCUS_LABEL, ROAST_LABEL } from "@/lib/labels";
import { btn } from "@/lib/ui";
import { fetchCheckIns } from "@/lib/checkins";
import { Chip } from "@/components/ui/Chip";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { DataError } from "@/components/ui/DataError";
import { Hero } from "@/components/ui/Img";
import { CheckInList } from "@/components/CheckInList";

type LinkRow = { relationship: string; source: string; source_url: string | null; confidence: number; roasters: { name: string; slug: string; roast_level: string | null; process_focus: string | null } | null };
const SOURCE_LABEL: Record<string, string> = { roaster_site: "listed on the roaster's site", cafe_site: "mentioned on the cafe's site", user_checkin: "from a check-in", manual: "added by a curator" };
const ext = "inline-flex items-center gap-1 label text-text transition hover:text-muted";

export async function generateMetadata({ params }: PageProps<"/cafes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const db = createSupabasePublicClient();
  const { data } = await db.from("cafes").select("name, city").eq("slug", slug).maybeSingle();
  return { title: data ? `${data.name}${data.city ? `, ${data.city}` : ""}` : "Cafe" };
}

async function CafeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createSupabasePublicClient();
  const { data: c } = await db
    .from("cafes")
    .select("id, name, address_line1, city, region, website, instagram, image_url, hours, has_espresso, has_pourover, has_batch_brew, is_multi_roaster, source, source_url, own:roasters!cafes_roaster_id_fkey(name, slug, roast_level, process_focus, image_url)")
    .eq("slug", slug)
    .maybeSingle();
  if (!c) notFound();
  const [{ data: score }, { data: links }, checkIns] = await Promise.all([
    db.from("cafe_scores").select("specialty_score, roaster_count, check_in_count, rating").eq("cafe_id", c.id).maybeSingle(),
    db.from("cafe_roasters").select("relationship, source, source_url, confidence, roasters(name, slug, roast_level, process_focus)").eq("cafe_id", c.id).order("confidence", { ascending: false }),
    fetchCheckIns(db, { cafeId: c.id }, 10).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
  ]);
  const rows = (links ?? []) as unknown as LinkRow[];
  const own = (Array.isArray(c.own) ? c.own[0] : c.own) as { name: string; slug: string; roast_level: string | null; process_focus: string | null; image_url: string | null } | null;
  const image = c.image_url ?? own?.image_url ?? null;
  const hours = (c.hours as { osm?: string } | null)?.osm;
  const mapsQuery = encodeURIComponent([c.name, c.address_line1, c.city].filter(Boolean).join(", "));

  return (
    <>
      <Link href="/cafes" className="label transition hover:text-text">← Cafes</Link>
      {image && <div className="mt-6"><Hero src={image} alt={c.name} /></div>}
      <div className="mt-8 flex items-start gap-6">
        <ScoreBadge score={score?.specialty_score} size="lg" />
        <div className="min-w-0 pt-1">
          <h1 className="text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">{c.name}</h1>
          <p className="mt-3 text-muted">{[c.address_line1, c.city, c.region].filter(Boolean).join(", ")}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {own && <Chip tone="accent">Roaster-owned</Chip>}
        {c.has_pourover && <Chip>Pour over</Chip>}
        {c.has_batch_brew && <Chip>Batch brew</Chip>}
        {c.has_espresso && <Chip>Espresso</Chip>}
        {c.is_multi_roaster && <Chip>Multi-roaster</Chip>}
      </div>
      {hours && <p className="mt-6 text-sm text-muted">Hours · {hours}</p>}
      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Link href={`/log?cafe=${slug}`} className={btn}><PenLine size={14} strokeWidth={1.6} /> Log a coffee here</Link>
        <a className={ext} href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">Directions <ArrowUpRight size={12} /></a>
        {c.website && <a className={ext} href={c.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={12} /></a>}
        {c.instagram && <a className={ext} href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer">@{c.instagram} <ArrowUpRight size={12} /></a>}
      </div>

      <section className="mt-16">
        <p className="label border-b border-border pb-3">Coffee served</p>
        {own && (
          <Link href={`/roasters/${own.slug}`} className="mt-4 flex items-center justify-between gap-4 border border-text px-5 py-4 transition hover:bg-surface-2">
            <span>
              <span className="font-medium">{own.name}</span>
              <span className="mt-0.5 block text-sm text-muted">The roaster&apos;s own cafe{[own.roast_level ? ROAST_LABEL[own.roast_level] : null, own.process_focus ? PROCESS_FOCUS_LABEL[own.process_focus] : null].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
            </span>
            <ArrowUpRight size={16} strokeWidth={1.4} className="shrink-0 text-muted" />
          </Link>
        )}
        {rows.length === 0 && !own && <p className="mt-4 text-sm text-muted">No roaster signal yet. If you know whose coffee they pour, a check-in will add it.</p>}
        {rows.length > 0 && (
          <ul className={own ? "mt-2" : ""}>
            {rows.map((l, i) =>
              l.roasters ? (
                <li key={i} className="border-b border-border py-4">
                  <Link href={`/roasters/${l.roasters.slug}`} className="font-medium underline decoration-transparent underline-offset-4 transition hover:decoration-text">{l.roasters.name}</Link>
                  <p className="mt-1 text-sm text-muted">
                    {[l.roasters.roast_level ? ROAST_LABEL[l.roasters.roast_level] : null, l.roasters.process_focus ? PROCESS_FOCUS_LABEL[l.roasters.process_focus] : null].filter(Boolean).join(" · ")}
                    {" · "}
                    {l.source_url ? <a className="underline decoration-border underline-offset-4 hover:decoration-text" href={l.source_url} target="_blank" rel="noreferrer">{SOURCE_LABEL[l.source] ?? l.source}</a> : (SOURCE_LABEL[l.source] ?? l.source)}
                  </p>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <p className="label border-b border-border pb-3">Recent check-ins</p>
        {checkIns instanceof Error ? <DataError error={checkIns} what="check-ins" /> : <CheckInList rows={checkIns} context="cafe" emptyText="No one has logged a coffee here yet. Be the first." />}
      </section>
      <p className="label mt-16">
        Base listing from {c.source_url ? <a className="underline decoration-border underline-offset-4 hover:decoration-text" href={c.source_url} target="_blank" rel="noreferrer">{c.source === "osm" ? "OpenStreetMap" : c.source === "roaster_site" ? "the roaster's site" : c.source}</a> : c.source}
      </p>
    </>
  );
}

export default function CafePage({ params }: PageProps<"/cafes/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <CafeDetail params={params} />
      </Suspense>
    </main>
  );
}
