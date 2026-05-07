"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const enableGoogle = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <h1 className="mb-2 font-serif text-2xl text-slate-800 dark:text-slate-50">Log in</h1>
        <p className="text-slate-600 dark:text-slate-200">
          Copy <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">apps/web/.env.local.example</code>{" "}
          to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code> and set your
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

  async function passwordSignIn() {
    const supabase = getSupabaseBrowserClient();
    setStatus(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Signed in.");
    router.push("/log/");
  }

  async function passwordSignUp() {
    const supabase = getSupabaseBrowserClient();
    setStatus(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirect },
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Account created. If confirmation is on, check your email.");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="mb-6 font-serif text-2xl text-slate-800 dark:text-slate-50">Log in</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Use password auth for reliable local dev; magic links stay available. Configure the
        redirect URL in Supabase: <code className="text-xs break-all">{redirect}</code>
      </p>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          placeholder="email@you.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy || !email.trim() || password.length < 8}
            onClick={() => void passwordSignIn()}
          >
            Sign in
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            disabled={busy || !email.trim() || password.length < 8}
            onClick={() => void passwordSignUp()}
          >
            Sign up
          </button>
        </div>
        <div className="text-center text-xs text-slate-500 dark:text-slate-400">or</div>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={busy || !email.trim()}
          onClick={() => void sendMagic()}
        >
          Email me a link
        </button>
        {enableGoogle && (
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            disabled={busy}
            onClick={() => void google()}
          >
            Continue with Google
          </button>
        )}
        {status && <p className="text-sm text-slate-600 dark:text-slate-200">{status}</p>}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-slate-600 underline dark:text-slate-300"
        >
          Home
        </button>
      </div>
    </div>
  );
}
