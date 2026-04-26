"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <h1 className="mb-2 font-serif text-2xl text-amber-950">Log in</h1>
        <p className="text-amber-900/80">
          Copy <code className="rounded bg-amber-200/30 px-1">apps/web/.env.local.example</code>{" "}
          to <code className="rounded bg-amber-200/30 px-1">.env.local</code> and set your
          Supabase project URL and anon key.
        </p>
      </div>
    );
  }

  const redirect = `${typeof window !== "undefined" ? window.location.origin : ""}${base}/auth/callback/`;

  async function sendMagic() {
    const supabase = getSupabaseBrowserClient();
    setStatus(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Check your email for a sign-in link.");
  }

  async function google() {
    const supabase = getSupabaseBrowserClient();
    setStatus(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect },
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
    } else {
      // redirect happens
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="mb-6 font-serif text-2xl text-amber-950">Log in</h1>
      <p className="mb-4 text-sm text-amber-900/70">
        We use email magic links and Google. Configure the redirect URL in the Supabase
        dashboard: <code className="text-xs break-all">{redirect}</code>
      </p>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          className="rounded border border-amber-900/20 bg-white px-3 py-2 text-amber-950"
          placeholder="email@you.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <button
          type="button"
          className="rounded bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 disabled:opacity-50"
          disabled={busy || !email.trim()}
          onClick={() => void sendMagic()}
        >
          Email me a link
        </button>
        <div className="text-center text-xs text-amber-800/50">or</div>
        <button
          type="button"
          className="rounded border border-amber-900/30 bg-white px-4 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
          disabled={busy}
          onClick={() => void google()}
        >
          Continue with Google
        </button>
        {status && <p className="text-sm text-amber-800/90">{status}</p>}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-amber-800/60 underline"
        >
          Home
        </button>
      </div>
    </div>
  );
}
