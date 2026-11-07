"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { sent?: string; error?: string };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "That doesn't look like an email address." };
  const next = safeNext(formData.get("next"));
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  return { sent: parsed.data };
}

export async function signOut() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/");
}
