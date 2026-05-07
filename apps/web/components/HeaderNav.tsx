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
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="font-serif text-lg font-semibold text-slate-800 dark:text-slate-50"
        >
          rate coffee
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-600 transition hover:text-slate-800 dark:text-slate-200 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          {loading && <span className="text-slate-500/50">…</span>}
          {!loading && !user && (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
            >
              Log in
            </Link>
          )}
          {!loading && user && (
            <div className="flex items-center gap-2">
              <span className="max-w-[8rem] truncate text-slate-600 dark:text-slate-300">
                {user.email}
              </span>
              {configured && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-slate-600 underline dark:text-slate-300"
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
