import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null; displayName: string; handle: string | null; role: string };

/** The signed-in user with their profile, or null. Server only; reads cookies. */
export async function getSessionUser(): Promise<SessionUser | null> {
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
