import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { CheckInForm, type Option } from "@/components/CheckInForm";

export const metadata: Metadata = { title: "Log a coffee" };

const CATEGORY_LABEL: Record<string, string> = { espresso: "Espresso", milk: "Milk drinks", filter: "Filter", immersion: "Immersion", cold: "Cold", other: "Other" };

async function LogInner({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const roasterSlug = typeof sp.roaster === "string" ? sp.roaster : null;
  const cafeSlug = typeof sp.cafe === "string" ? sp.cafe : null;
  const coffeeId = typeof sp.coffee === "string" ? sp.coffee : undefined;
  const here = `/log?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()}`;

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);

  const db = createSupabasePublicClient();
  const [{ data: roaster }, { data: cafe }, { data: brews }, { data: tags }] = await Promise.all([
    roasterSlug ? db.from("roasters").select("id, name, slug").eq("slug", roasterSlug).maybeSingle() : Promise.resolve({ data: null }),
    cafeSlug ? db.from("cafes").select("id, name, slug, roaster_id, own:roasters!cafes_roaster_id_fkey(id, name), cafe_roasters(roasters(id, name))").eq("slug", cafeSlug).maybeSingle() : Promise.resolve({ data: null }),
    db.from("brew_methods").select("id, label, category").order("sort_order"),
    db.from("flavor_tags").select("id, label").order("sort_order"),
  ]);

  // Roaster choices on a cafe page: the owner first, then everyone the cafe is known to serve.
  const own = cafe ? ((Array.isArray(cafe.own) ? cafe.own[0] : cafe.own) as { id: string; name: string } | null) : null;
  const servedRaw = (cafe?.cafe_roasters ?? []) as unknown as { roasters: { id: string; name: string } | null }[];
  const roasterOptions: Option[] = [];
  const seen = new Set<string>();
  for (const r of [own, ...servedRaw.map((l) => l.roasters)]) {
    if (r && !seen.has(r.id)) { seen.add(r.id); roasterOptions.push({ id: r.id, label: r.name }); }
  }

  const { data: coffeeRows } = roaster
    ? await db.from("coffees").select("id, name, status").eq("roaster_id", roaster.id).order("status").order("name")
    : { data: [] as { id: string; name: string; status: string }[] };
  const coffees: Option[] = (coffeeRows ?? []).map((c) => ({ id: c.id, label: c.status === "active" ? c.name : `${c.name} (past)` }));

  const subject = [roaster?.name, cafe ? `at ${cafe.name}` : null].filter(Boolean).join(" ");
  const next = cafe ? `/cafes/${cafe.slug}` : roaster ? `/roasters/${roaster.slug}` : "/me";

  return (
    <>
      <p className="label">Check-in</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight">Log a coffee</h1>
      {subject ? (
        <p className="mt-3 text-muted">{subject}</p>
      ) : (
        <p className="mt-3 text-muted">Start from a <Link href="/roasters" className="underline decoration-border underline-offset-4 hover:decoration-text">roaster</Link> or <Link href="/cafes" className="underline decoration-border underline-offset-4 hover:decoration-text">cafe</Link> page to log a specific coffee.</p>
      )}
      <div className="mt-8 border-t border-border pt-6">
        <CheckInForm
          roaster={roaster ? { id: roaster.id, name: roaster.name } : null}
          cafe={cafe ? { id: cafe.id, name: cafe.name } : null}
          coffees={coffees}
          roasterOptions={roasterOptions}
          brewMethods={(brews ?? []).map((b) => ({ id: b.id, label: b.label, group: CATEGORY_LABEL[b.category] ?? b.category }))}
          tags={(tags ?? []).map((t) => ({ id: t.id, label: t.label }))}
          initialCoffeeId={coffeeId}
          next={next}
        />
      </div>
    </>
  );
}

export default function LogPage({ searchParams }: PageProps<"/log">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-24 pt-14">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <LogInner searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
