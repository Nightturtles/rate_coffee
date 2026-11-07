import { Suspense } from "react";
import { RoasterCard } from "@/components/Cards";
import { LocationPicker } from "@/components/LocationPicker";
import { DataError } from "@/components/ui/DataError";
import { discoverRoasters, placeFromParams, MI } from "@/lib/discovery";

export const metadata = { title: "Roasters" };

async function List({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let roasters;
  try {
    roasters = await discoverRoasters(place, 60 * MI, 100);
  } catch (e) {
    return <DataError error={e} what="roasters" />;
  }
  if (roasters.length === 0) return <p className="mt-8 text-muted">No roasters within 60 miles yet.</p>;
  return (
    <>
      <p className="label mt-8">{roasters.length} roasters within 60 mi</p>
      <div className="mt-3 grid sm:grid-cols-2 sm:gap-x-12">{roasters.map((r, i) => <RoasterCard key={r.id} r={r} index={i + 1} />)}</div>
    </>
  );
}

async function RoastersPageInner({ searchParams }: { searchParams: PageProps<"/roasters">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14">
      <p className="label">Roasters</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">Ranked by how they roast and source.</h1>
      <p className="mt-4 max-w-xl text-muted">Roast level, process, single-origin share, and menu depth, read from each roaster&apos;s live menu.</p>
      <div className="mt-10">
        <LocationPicker current={place} fromUrl={typeof sp.lat === "string"} />
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <List place={place} />
      </Suspense>
    </main>
  );
}

export default function RoastersPage({ searchParams }: PageProps<"/roasters">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-5 py-14 text-muted">Loading…</main>}>
      <RoastersPageInner searchParams={searchParams} />
    </Suspense>
  );
}
