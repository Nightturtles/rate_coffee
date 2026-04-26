"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const links = [
  { href: "/log", label: "Log" },
  { href: "/map", label: "Map" },
] as const;

export function HeaderNav() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-amber-900/15 bg-amber-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="font-serif text-lg font-semibold text-amber-950"
        >
          rate coffee
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-amber-900/80 transition hover:text-amber-900"
            >
              {l.label}
            </Link>
          ))}
          {loading && <span className="text-amber-800/50">…</span>}
          {!loading && !user && (
            <Link
              href="/login"
              className="rounded-md bg-amber-900 px-3 py-1.5 text-white"
            >
              Log in
            </Link>
          )}
          {!loading && user && (
            <div className="flex items-center gap-2">
              <span className="max-w-[8rem] truncate text-amber-800/80">
                {user.email}
              </span>
              {configured && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-amber-800/80 underline"
                >
                  Out
                </button>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
