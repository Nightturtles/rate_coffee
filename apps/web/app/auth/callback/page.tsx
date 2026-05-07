"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function CallbackBody() {
  const router = useRouter();
  const search = useSearchParams();
  const [message, setMessage] = useState("Signing in…");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured. Add env keys.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const code = search.get("code");
    const err = search.get("error");
    if (err) {
      setMessage(`Auth error: ${err}`);
      return;
    }
    if (code) {
      void (async () => {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // In implicit flow, code exchange is not required.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setMessage(error.message);
            return;
          }
        }
        router.replace("/log/");
      })();
      return;
    }
    // Magic link or implicit — try session from hash (handled by client sometimes)
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/log/");
        return;
      }
      setMessage("No auth code in URL. Try again from the login page.");
    })();
  }, [search, router]);

  return <p className="text-slate-600 dark:text-slate-200">{message}</p>;
}

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Suspense fallback={<p>Loading…</p>}>
        <CallbackBody />
      </Suspense>
    </div>
  );
}
