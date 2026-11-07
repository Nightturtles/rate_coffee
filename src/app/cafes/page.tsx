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
    return <div className="mt-6"><DataError error={e} what="cafes" /></div>;
  }
  const known = new Set(signal.map((c) => c.id));
  const rest = all.filter((c) => !known.has(c.id));
  return (
    <>
      <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted">Known to serve a cataloged roaster ({signal.length})</h2>
      {signal.length === 0 ? <p className="mt-2 text-muted">None within 20 miles yet.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{signal.map((c) => <CafeCard key={c.id} c={c} />)}</div>}
      <details className="mt-10">
        <summary className="cursor-pointer text-sm text-muted">Other cafes within 10 miles, no roaster signal yet ({rest.length})</summary>
        <ul className="mt-3 columns-2 gap-6 text-sm sm:columns-3">
          {rest.map((c) => (
            <li key={c.id} className="break-inside-avoid py-0.5">
              <a href={`/cafes/${c.slug}`} className="underline-offset-4 hover:underline">{c.name}</a>
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
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Cafes</h1>
      <p className="mt-1 text-muted">Ranked by whose coffee they pour. Links come from roaster stockist pages and cafe websites, with the source shown on each cafe.</p>
      <div className="mt-4">
        <LocationPicker current={place} fromUrl={typeof sp.lat === "string"} />
      </div>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <List place={place} />
      </Suspense>
    </main>
  );
}

export default function CafesPage({ searchParams }: PageProps<"/cafes">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8 text-muted">Loading…</main>}>
      <CafesPageInner searchParams={searchParams} />
    </Suspense>
  );
}
