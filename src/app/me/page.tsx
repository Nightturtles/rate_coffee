import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { fetchCheckIns, type CheckInRow } from "@/lib/checkins";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { CheckInList } from "@/components/CheckInList";
import { DataError } from "@/components/ui/DataError";
import { btn, btnOutline } from "@/lib/ui";

export const metadata: Metadata = { title: "Your check-ins" };

async function MeInner() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");
  const db = await createSupabaseServerClient();
  let rows: CheckInRow[] | Error;
  try {
    rows = await fetchCheckIns(db, { userId: user.id }, 100);
  } catch (e) {
    rows = e instanceof Error ? e : new Error(String(e));
  }
  const avg = !(rows instanceof Error) && rows.length ? rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length : null;
  const list = rows instanceof Error ? (
    <DataError error={rows} what="your check-ins" />
  ) : (
    <>
      <p className="label mt-12 border-b border-border pb-3">{rows.length} check-in{rows.length === 1 ? "" : "s"}{avg != null ? ` · ${avg.toFixed(1)} average` : ""}</p>
      <CheckInList rows={rows} context="me" emptyText="Nothing logged yet. Open a roaster or cafe and hit Log a coffee." />
    </>
  );
  return (
    <>
      <p className="label">Your account</p>
      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight">{user.displayName}</h1>
          <p className="mt-2 text-sm text-muted">{user.email}{user.role !== "user" ? ` · ${user.role}` : ""}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className={btnOutline}>Sign out</button>
        </form>
      </div>
      <Link href="/log" className={`${btn} mt-8`}>Log a coffee</Link>
      {list}
    </>
  );
}

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-14">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <MeInner />
      </Suspense>
    </main>
  );
}
