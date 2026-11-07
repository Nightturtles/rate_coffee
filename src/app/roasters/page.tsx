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
    return <div className="mt-6"><DataError error={e} what="roasters" /></div>;
  }
  if (roasters.length === 0) return <p className="mt-6 text-muted">No roasters within 60 miles yet.</p>;
  return <div className="mt-6 grid gap-3 sm:grid-cols-2">{roasters.map((r) => <RoasterCard key={r.id} r={r} />)}</div>;
}

async function RoastersPageInner({ searchParams }: { searchParams: PageProps<"/roasters">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Roasters</h1>
      <p className="mt-1 text-muted">Ranked by specialty score: roast level, sourcing, process, and menu depth, from each roaster&apos;s live menu.</p>
      <div className="mt-4">
        <LocationPicker current={place} fromUrl={typeof sp.lat === "string"} />
      </div>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <List place={place} />
      </Suspense>
    </main>
  );
}

export default function RoastersPage({ searchParams }: PageProps<"/roasters">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8 text-muted">Loading…</main>}>
      <RoastersPageInner searchParams={searchParams} />
    </Suspense>
  );
}
