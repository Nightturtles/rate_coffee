import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "./SearchBox";
import { UserMenu } from "./UserMenu";

const links = [
  { href: "/", label: "Discover" },
  { href: "/explore", label: "Map" },
  { href: "/roasters", label: "Roasters" },
  { href: "/cafes", label: "Cafes" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-5">
        <Link href="/" className="whitespace-nowrap font-display text-[13px] font-semibold uppercase tracking-[0.28em]">
          Rate Coffee
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="label text-text transition hover:text-muted">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full max-w-[260px]">
          <SearchBox />
        </div>
        <div className="hidden shrink-0 md:block">
          <Suspense fallback={<span className="inline-block h-8 w-16" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
