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
    <header className="border-b border-sage-200 bg-sage-50/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="font-serif text-lg font-semibold text-sage-900"
        >
          rate coffee
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sage-700 transition hover:text-sage-900"
            >
              {l.label}
            </Link>
          ))}
          {loading && <span className="text-sage-400/70">…</span>}
          {!loading && !user && (
            <Link
              href="/login"
              className="rounded-md bg-sage-600 px-3 py-1.5 text-sage-50 hover:bg-sage-700"
            >
              Log in
            </Link>
          )}
          {!loading && user && (
            <div className="flex items-center gap-2">
              <span className="max-w-[8rem] truncate text-sage-700">
                {user.email}
              </span>
              {configured && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-sage-700 underline"
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
