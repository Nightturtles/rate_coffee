import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/** Anonymous client for public catalog reads on the server. No cookies, so it is cache-friendly. */
export function createSupabasePublicClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase env not set");
  return createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
