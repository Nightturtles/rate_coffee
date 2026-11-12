import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

const link = "label text-text transition hover:text-muted";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-14">
      <p className="label">404</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight">Nothing here.</h1>
      <p className="mt-3 max-w-md text-muted">
        That page doesn&apos;t exist. If you followed a link to a roaster or cafe, it may have been renamed or removed from the list.
      </p>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
        <Link href="/" className={link}>Discover</Link>
        <Link href="/roasters" className={link}>Roasters</Link>
        <Link href="/cafes" className={link}>Cafes</Link>
        <Link href="/explore" className={link}>Map</Link>
      </div>
    </main>
  );
}
