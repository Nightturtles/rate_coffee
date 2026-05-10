"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inputClass } from "@/lib/form-classes";
import { cn } from "@/lib/utils";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const enableGoogle = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

const loginInputClass = cn(inputClass, "w-full px-3 py-2");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Log in</CardTitle>
            <CardDescription>
              Copy <code className="rounded bg-muted px-1 py-0.5 text-foreground">apps/web/.env.local.example</code>{" "}
              to <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> and set your
              Supabase project URL and anon key.
            </CardDescription>
          </CardHeader>
        </Card>
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
    <div className="mx-auto max-w-md px-4 pt-20">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Log in</CardTitle>
          <CardDescription>
            Use password auth for reliable local dev; magic links stay available. Configure the
            redirect URL in Supabase: <code className="text-xs break-all text-foreground">{redirect}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            type="email"
            className={loginInputClass}
            placeholder="email@you.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            className={loginInputClass}
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              disabled={busy || !email.trim() || password.length < 8}
              onClick={() => void passwordSignIn()}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !email.trim() || password.length < 8}
              onClick={() => void passwordSignUp()}
            >
              Sign up
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">or</p>
          <Button type="button" disabled={busy || !email.trim()} onClick={() => void sendMagic()}>
            Email me a link
          </Button>
          {enableGoogle && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void google()}>
              Continue with Google
            </Button>
          )}
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" onClick={() => router.push("/")}>
            Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
