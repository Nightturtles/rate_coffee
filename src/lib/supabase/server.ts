import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for server components, route handlers, and server actions.
 * Reads the signed-in user's session from cookies. Throws if env is missing.
 */
export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component: cookies are read-only there.
          // The proxy/middleware refresh step handles writes in that case.
        }
      },
    },
  });
}
