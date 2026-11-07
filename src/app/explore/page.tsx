import { Suspense } from "react";
import { ExploreMap } from "@/components/ExploreMap";
import { placeFromParams } from "@/lib/discovery";

export const metadata = { title: "Map" };

async function ExplorePageInner({ searchParams }: { searchParams: PageProps<"/explore">["searchParams"] }) {
  const sp = await searchParams;
  const place = placeFromParams(sp);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4">
      <Suspense fallback={<p className="text-muted">Loading map…</p>}>
        <ExploreMap initial={place} />
      </Suspense>
    </main>
  );
}

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8 text-muted">Loading…</main>}>
      <ExplorePageInner searchParams={searchParams} />
    </Suspense>
  );
}
