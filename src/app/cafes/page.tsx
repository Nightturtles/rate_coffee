import Link from "next/link";
import { Suspense } from "react";
import { CafeCard } from "@/components/Cards";
import { LocationPicker } from "@/components/LocationPicker";
import { DataError } from "@/components/ui/DataError";
import { discoverCafes, placeFromParams, MI } from "@/lib/discovery";

export const metadata = { title: "Cafes" };

async function List({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let signal, all;
  try {
    [signal, all] = await Promise.all([discoverCafes(place, 20 * MI, 200, true), discoverCafes(place, 10 * MI, 300, false)]);
  } catch (e) {
    return <DataError error={e} what="cafes" />;
  }
  const known = new Set(signal.map((c) => c.id));
  const rest = all.filter((c) => !known.has(c.id));
  return (
    <>
      <p className="label mt-8">{signal.length} cafes known to serve a cataloged roaster · 20 mi</p>
      {signal.length === 0 ? <p className="mt-3 text-muted">None within 20 miles yet.</p> : <div className="mt-3 grid sm:grid-cols-2 sm:gap-x-12">{signal.map((c, i) => <CafeCard key={c.id} c={c} index={i + 1} />)}</div>}
      <details className="mt-16 border-t border-border pt-5">
        <summary className="label cursor-pointer text-text">Other cafes within 10 mi, no roaster signal yet · {rest.length}</summary>
        <ul className="mt-5 columns-2 gap-10 text-sm sm:columns-3">
          {rest.map((c) => (
            <li key={c.id} className="break-inside-avoid border-b border-border py-2">
              <Link href={`/cafes/${c.slug}`} className="transition hover:text-muted">{c.name}</Link>
              <span className="text-muted">{c.city ? `, ${c.city}` : ""}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

async function CafesPageInner({ searchParams }: { searchParams: PageProps<"/cafes">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14">
      <p className="label">Cafes</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">Ranked by whose coffee they pour.</h1>
      <p className="mt-4 max-w-xl text-muted">Links come from roaster stockist pages, cafe websites, and check-ins. Each cafe shows its sources.</p>
      <div className="mt-10">
        <LocationPicker current={place} fromUrl={typeof sp.lat === "string"} />
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <List place={place} />
      </Suspense>
    </main>
  );
}

export default function CafesPage({ searchParams }: PageProps<"/cafes">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-5 py-14 text-muted">Loading…</main>}>
      <CafesPageInner searchParams={searchParams} />
    </Suspense>
  );
}
