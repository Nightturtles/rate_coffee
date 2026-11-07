import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AtSign, ExternalLink, Navigation } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { PROCESS_FOCUS_LABEL, ROAST_LABEL } from "@/lib/labels";
import { Chip } from "@/components/ui/Chip";
import { ScoreBadge } from "@/components/ui/ScoreBadge";

type LinkRow = { relationship: string; source: string; source_url: string | null; confidence: number; roasters: { name: string; slug: string; roast_level: string | null; process_focus: string | null } | null };
const SOURCE_LABEL: Record<string, string> = { roaster_site: "listed on the roaster's site", cafe_site: "mentioned on the cafe's site", user_checkin: "from a check-in", manual: "added by a curator" };

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
    .select("id, name, address_line1, city, region, website, instagram, hours, has_espresso, has_pourover, has_batch_brew, is_multi_roaster, source, source_url, own:roasters!cafes_roaster_id_fkey(name, slug, roast_level, process_focus)")
    .eq("slug", slug)
    .maybeSingle();
  if (!c) notFound();
  const [{ data: score }, { data: links }] = await Promise.all([
    db.from("cafe_scores").select("specialty_score, roaster_count, check_in_count, rating").eq("cafe_id", c.id).maybeSingle(),
    db.from("cafe_roasters").select("relationship, source, source_url, confidence, roasters(name, slug, roast_level, process_focus)").eq("cafe_id", c.id).order("confidence", { ascending: false }),
  ]);
  const rows = (links ?? []) as unknown as LinkRow[];
  const own = (Array.isArray(c.own) ? c.own[0] : c.own) as { name: string; slug: string; roast_level: string | null; process_focus: string | null } | null;
  const hours = (c.hours as { osm?: string } | null)?.osm;
  const mapsQuery = encodeURIComponent([c.name, c.address_line1, c.city].filter(Boolean).join(", "));

  return (
    <>
      <Link href="/cafes" className="text-sm text-muted underline-offset-4 hover:underline">← Cafes</Link>
      <div className="mt-3 flex items-start gap-4">
        <ScoreBadge score={score?.specialty_score} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{c.name}</h1>
          <p className="text-muted">{[c.address_line1, c.city, c.region].filter(Boolean).join(", ")}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {own && <Chip tone="accent">Roaster-owned</Chip>}
        {c.has_pourover && <Chip>Pour over</Chip>}
        {c.has_batch_brew && <Chip>Batch brew</Chip>}
        {c.has_espresso && <Chip>Espresso</Chip>}
        {c.is_multi_roaster && <Chip>Multi-roaster</Chip>}
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer"><Navigation size={14} /> Directions</a>
        {c.website && <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={c.website} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Website</a>}
        {c.instagram && <a className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline" href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer"><AtSign size={14} /> @{c.instagram}</a>}
      </p>
      {hours && <p className="mt-2 text-sm text-muted">Hours: {hours}</p>}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Coffee served</h2>
        {own && (
          <Link href={`/roasters/${own.slug}`} className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-accent/40 bg-accent/10 p-4 hover:border-accent">
            <span>
              <span className="font-medium">{own.name}</span>
              <span className="block text-sm text-muted">This is the roaster&apos;s own cafe{[own.roast_level ? ROAST_LABEL[own.roast_level] : null, own.process_focus ? PROCESS_FOCUS_LABEL[own.process_focus] : null].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
            </span>
          </Link>
        )}
        {rows.length === 0 && !own && <p className="mt-2 text-muted">No roaster signal yet. If you know whose coffee they pour, a check-in will add it.</p>}
        {rows.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
            {rows.map((l, i) =>
              l.roasters ? (
                <li key={i} className="px-4 py-3">
                  <Link href={`/roasters/${l.roasters.slug}`} className="font-medium underline-offset-4 hover:underline">{l.roasters.name}</Link>
                  <p className="text-sm text-muted">
                    {[l.roasters.roast_level ? ROAST_LABEL[l.roasters.roast_level] : null, l.roasters.process_focus ? PROCESS_FOCUS_LABEL[l.roasters.process_focus] : null].filter(Boolean).join(" · ")}
                    {" · "}
                    {l.source_url ? <a className="underline underline-offset-4" href={l.source_url} target="_blank" rel="noreferrer">{SOURCE_LABEL[l.source] ?? l.source}</a> : (SOURCE_LABEL[l.source] ?? l.source)}
                  </p>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
      <p className="mt-10 text-xs text-muted">
        Base listing from {c.source_url ? <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">{c.source === "osm" ? "OpenStreetMap" : c.source === "roaster_site" ? "the roaster's site" : c.source}</a> : c.source}.
      </p>
    </>
  );
}

export default function CafePage({ params }: PageProps<"/cafes/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <CafeDetail params={params} />
      </Suspense>
    </main>
  );
}
