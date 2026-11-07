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
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="whitespace-nowrap font-display text-xl font-semibold tracking-tight">
          rate coffee
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full max-w-xs">
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
