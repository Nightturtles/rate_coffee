import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

async function LoginInner({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSessionUser()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <>
      {error && <p role="alert" className="mb-5 border border-bronze/50 px-4 py-3 text-sm text-bronze">{error}</p>}
      <LoginForm next={next} google={process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1"} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-24 pt-14">
      <p className="label">Account</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted">Log what you drink. Your ratings feed the roaster and cafe scores.</p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <LoginInner searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-10 text-sm text-muted">
        What we store and who can see it: <Link href="/privacy" className="underline decoration-border underline-offset-4 transition hover:decoration-text">Privacy</Link>
      </p>
    </main>
  );
}
