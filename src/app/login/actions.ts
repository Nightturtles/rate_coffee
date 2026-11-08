"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyAuthError, safeNext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { sent?: string; error?: string };

const Email = z.string().trim().email();

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Step 1: email a one-time code (and a link, for clients that prefer tapping). */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "That doesn't look like an email address." };
  const next = safeNext(formData.get("next"));
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { sent: parsed.data };
}

/**
 * Step 2: the six-digit code from the email. Immune to link scanners that open (and burn) magic
 * links before the user does, and it works even when the email is read on another device.
 */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Start over with your email address." };
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (token.length !== 6) return { sent: parsed.data, error: "Enter the 6-digit code from the email." };
  const next = safeNext(formData.get("next"));
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.verifyOtp({ email: parsed.data, token, type: "email" });
  if (error) return { sent: parsed.data, error: friendlyAuthError(error.message) };
  redirect(next);
}

/** Google OAuth via Supabase. Needs the provider enabled in the Supabase dashboard (see README). */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const db = await createSupabaseServerClient();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(friendlyAuthError(error?.message ?? "provider is not enabled"))}&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/");
}
