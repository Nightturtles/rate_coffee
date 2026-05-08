"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const links = [
  { href: "/log", label: "Log" },
  { href: "/activity", label: "Activity" },
  { href: "/add", label: "Add" },
  { href: "/map", label: "Map" },
] as const;

function pathIsActive(pathname: string, href: string) {
  if (pathname === href || pathname === `${href}/`) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

const linkBase =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 text-sage-600 hover:bg-sage-100/90 hover:text-sage-900";

function activeLinkClass(pathname: string, href: string) {
  return pathIsActive(pathname, href)
    ? "bg-sage-100 font-semibold text-sage-900"
    : "";
}

export function HeaderNav() {
  const pathname = usePathname();
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const loginClasses = [
    linkBase,
    activeLinkClass(pathname, "/login"),
    !pathIsActive(pathname, "/login") ? "inline-flex items-center justify-center" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const authDesktop = (
    <>
      {loading && <span className="text-sm text-sage-400/70">…</span>}
      {!loading && !user && (
        <Link href="/login" className={loginClasses}>
          Log in
        </Link>
      )}
      {!loading && user && (
        <div className="flex items-center gap-2">
          <span className="max-w-[140px] truncate text-sm text-sage-700">{user.email}</span>
          {configured && (
            <button
              type="button"
              onClick={() => void signOut()}
              className={`${linkBase} cursor-pointer border-0 bg-transparent font-[inherit]`}
            >
              Out
            </button>
          )}
        </div>
      )}
    </>
  );

  const authMobile = (
    <div className="mt-2 border-t border-sage-200 pt-3 md:hidden">
      {loading && <span className="text-sm text-sage-400/70">…</span>}
      {!loading && !user && (
        <Link
          href="/login"
          className={`${loginClasses} w-full`}
          onClick={() => setNavOpen(false)}
        >
          Log in
        </Link>
      )}
      {!loading && user && (
        <div className="flex flex-col gap-2">
          <span className="max-w-full truncate text-sm text-sage-700">{user.email}</span>
          {configured && (
            <button
              type="button"
              onClick={() => {
                setNavOpen(false);
                void signOut();
              }}
              className={`${linkBase} w-full cursor-pointer text-left font-[inherit]`}
            >
              Out
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-[100] border-b border-sage-200 bg-sage-50/95 shadow-sm backdrop-blur">
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 md:min-h-[3.25rem] md:flex-nowrap md:justify-center md:py-2">
        <Link
          href="/"
          className="order-1 font-serif text-lg font-semibold text-sage-900 md:absolute md:left-4 md:top-1/2 md:-translate-y-1/2"
        >
          rate coffee
        </Link>

        <button
          type="button"
          className="order-2 ml-auto flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-md hover:bg-sage-100/80 md:hidden"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <span
            className={`block h-0.5 w-5 rounded-full bg-sage-600 transition-transform duration-200 ${navOpen ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-sage-600 transition-opacity duration-200 ${navOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-sage-600 transition-transform duration-200 ${navOpen ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </button>

        <nav
          aria-label="Main navigation"
          className={`order-3 flex w-full basis-full flex-col gap-0.5 md:order-none md:w-auto md:basis-auto md:flex-row md:items-center md:gap-0.5 ${navOpen ? "flex" : "hidden"} md:flex`}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={[linkBase, activeLinkClass(pathname, l.href), "max-md:w-full max-md:py-2"].join(" ")}
              onClick={() => setNavOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {authMobile}
        </nav>

        <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 md:flex md:items-center md:gap-2">
          {authDesktop}
        </div>
      </div>
    </header>
  );
}
