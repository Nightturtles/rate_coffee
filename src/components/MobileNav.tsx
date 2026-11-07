"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, Flame, Store, User } from "lucide-react";

const items = [
  { href: "/", label: "Discover", Icon: Compass },
  { href: "/explore", label: "Map", Icon: Map },
  { href: "/roasters", label: "Roasters", Icon: Flame },
  { href: "/cafes", label: "Cafes", Icon: Store },
  { href: "/me", label: "Me", Icon: User },
] as const;

export function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent" : "text-muted"}`} aria-current={active ? "page" : undefined}>
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
