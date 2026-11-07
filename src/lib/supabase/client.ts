"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Supabase client for client components. One instance per browser tab. */
export function getSupabaseBrowserClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase env not set");
  client ??= createBrowserClient(env.url, env.anonKey);
  return client;
}
