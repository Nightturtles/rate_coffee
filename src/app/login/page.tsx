import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

async function LoginInner({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSessionUser()) redirect(next);
  return <LoginForm next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-muted">Log what you drink. Your ratings feed the roaster and cafe scores.</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <LoginInner searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
