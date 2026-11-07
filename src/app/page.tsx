import Link from "next/link";
import { Suspense } from "react";
import { CafeCard, RoasterCard } from "@/components/Cards";
import { LocationPicker } from "@/components/LocationPicker";
import { Section } from "@/components/ui/Section";
import { DataError } from "@/components/ui/DataError";
import { discoverCafes, discoverRoasters, placeFromParams, placeQuery, MI } from "@/lib/discovery";

async function HomeInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  const fromUrl = typeof sp.lat === "string";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Specialty coffee, <span className="text-accent">actually</span> near you.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Roasters ranked by how they roast and source. Cafes ranked by whose coffee they pour.
        </p>
      </div>
      <div className="mt-6">
        <LocationPicker current={place} fromUrl={fromUrl} />
      </div>

      <Suspense fallback={<Skeleton title="Cafes" />}>
        <Cafes place={place} />
      </Suspense>
      <Suspense fallback={<Skeleton title="Roasters" />}>
        <Roasters place={place} />
      </Suspense>

      <p className="mt-12 text-sm text-muted">
        Scores come from each roaster&apos;s live menu (roast level, process, single-origin share) and from which roasters a cafe serves. Check-ins will refine them.{" "}
        <Link href={`/explore?${placeQuery(place)}`} className="text-accent underline-offset-4 hover:underline">
          Open the map
        </Link>
        .
      </p>
    </main>
  );
}

async function Cafes({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let cafes;
  try {
    cafes = await discoverCafes(place, 15 * MI, 8);
  } catch (e) {
    return <Section title={`Cafes near ${place.label}`}><DataError error={e} what="cafes" /></Section>;
  }
  return (
    <Section title={`Cafes near ${place.label}`} subtitle="Known to serve a cataloged roaster, best first" href={`/cafes?${placeQuery(place)}`}>
      {cafes.length === 0 ? (
        <Empty>No cafes with a roaster signal within 15 miles yet. Try the map or a nearby city.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{cafes.map((c) => <CafeCard key={c.id} c={c} />)}</div>
      )}
    </Section>
  );
}

async function Roasters({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let roasters;
  try {
    roasters = await discoverRoasters(place, 35 * MI, 8);
  } catch (e) {
    return <Section title={`Roasters near ${place.label}`}><DataError error={e} what="roasters" /></Section>;
  }
  return (
    <Section title={`Roasters near ${place.label}`} subtitle="Within 35 miles, best first" href={`/roasters?${placeQuery(place)}`}>
      {roasters.length === 0 ? (
        <Empty>No roasters within 35 miles yet.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{roasters.map((r) => <RoasterCard key={r.id} r={r} />)}</div>
      )}
    </Section>
  );
}

function Skeleton({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />)}
      </div>
    </Section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[var(--radius-card)] border border-dashed border-border p-6 text-sm text-muted">{children}</p>;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8 text-muted">Loading…</main>}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}
