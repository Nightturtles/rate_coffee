import Link from "next/link";
import { Suspense } from "react";
import { CafeCard, RoasterCard } from "@/components/Cards";
import { LocationPicker } from "@/components/LocationPicker";
import { Section } from "@/components/ui/Section";
import { DataError } from "@/components/ui/DataError";
import { discoverCafes, discoverRoasters, placeFromParams, placeQuery, MI } from "@/lib/discovery";
import { linkQuiet } from "@/lib/ui";

async function HomeInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  const fromUrl = typeof sp.lat === "string";
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14">
      <div className="max-w-3xl">
        <p className="label">Specialty coffee, found properly</p>
        <h1 className="mt-4 text-[2.6rem] font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Good coffee, actually near you.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          Roasters ranked by how they roast and source. Cafes ranked by whose coffee they pour.
        </p>
      </div>
      <div className="mt-10">
        <LocationPicker current={place} fromUrl={fromUrl} />
      </div>

      <Suspense fallback={<Skeleton title="Cafes" />}>
        <Cafes place={place} />
      </Suspense>
      <Suspense fallback={<Skeleton title="Roasters" />}>
        <Roasters place={place} />
      </Suspense>

      <p className="mt-20 max-w-2xl border-t border-border pt-6 text-sm leading-relaxed text-muted">
        Scores come from each roaster&apos;s live menu (roast level, process, single-origin share) and from which roasters a cafe serves. Check-ins refine them over time.{" "}
        <Link href={`/explore?${placeQuery(place)}`} className={linkQuiet}>Open the map</Link>.
      </p>
    </main>
  );
}

async function Cafes({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let cafes;
  try {
    cafes = await discoverCafes(place, 15 * MI, 8);
  } catch (e) {
    return <Section eyebrow="Cafes" title={`Near ${place.label}`}><DataError error={e} what="cafes" /></Section>;
  }
  return (
    <Section eyebrow="Cafes" title={`Near ${place.label}`} subtitle="Known to serve a cataloged roaster, best first" href={`/cafes?${placeQuery(place)}`}>
      {cafes.length === 0 ? (
        <Empty>No cafes with a roaster signal within 15 miles yet. Try the map or a nearby city.</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 sm:gap-x-12">{cafes.map((c, i) => <CafeCard key={c.id} c={c} index={i + 1} />)}</div>
      )}
    </Section>
  );
}

async function Roasters({ place }: { place: ReturnType<typeof placeFromParams> }) {
  let roasters;
  try {
    roasters = await discoverRoasters(place, 35 * MI, 8);
  } catch (e) {
    return <Section eyebrow="Roasters" title={`Near ${place.label}`}><DataError error={e} what="roasters" /></Section>;
  }
  return (
    <Section eyebrow="Roasters" title={`Near ${place.label}`} subtitle="Within 35 miles, best first" href={`/roasters?${placeQuery(place)}`}>
      {roasters.length === 0 ? (
        <Empty>No roasters within 35 miles yet.</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 sm:gap-x-12">{roasters.map((r, i) => <RoasterCard key={r.id} r={r} index={i + 1} />)}</div>
      )}
    </Section>
  );
}

function Skeleton({ title }: { title: string }) {
  return (
    <Section eyebrow={title} title=" ">
      <div className="grid sm:grid-cols-2 sm:gap-x-12">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse border-t border-border" />)}
      </div>
    </Section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-sm text-muted">{children}</p>;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-5 py-14 text-muted">Loading…</main>}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}
