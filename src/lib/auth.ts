import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null; displayName: string; handle: string | null; role: string };

/** The signed-in user with their profile, or null. Server only; reads cookies. */
export async function getSessionUser(): Promise<SessionUser | null> {
  await connection(); // session reads are per-request; never prerender them
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db.from("profiles").select("display_name, handle, role").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: p?.display_name || user.email?.split("@")[0] || "you",
    handle: p?.handle ?? null,
    role: p?.role ?? "user",
  };
}

/** Only allow same-origin relative paths as post-login destinations. */
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Supabase auth errors in plain words. Falls back to the raw message. */
export function friendlyAuthError(message: string | null | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Something went wrong signing you in.";
  if (/expired|invalid|already been used|not found/.test(m)) return "That code or link didn't work. It may have expired or been used already; check it, or send a new one.";
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/.test(m)) return "Too many sign-in emails just now. Wait a few minutes and try again.";
  if (/provider is not enabled|unsupported provider/.test(m)) return "Google sign-in isn't switched on for this site yet.";
  return message as string;
}
