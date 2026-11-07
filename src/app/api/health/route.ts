import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * GET /api/health
 * Reports whether the app can see its Supabase project. Schema-independent:
 * it only pings the auth settings endpoint, so it works before any migrations run.
 */
export async function GET() {
  const env = getSupabaseEnv();
  if (!env) {
    return Response.json({ ok: false, supabase: "not configured" }, { status: 503 });
  }
  try {
    // Auth settings is public, schema-independent, and accepts publishable keys.
    const res = await fetch(`${env.url}/auth/v1/settings`, {
      headers: { apikey: env.anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const reachable = res.ok;
    return Response.json(
      { ok: reachable, supabase: reachable ? "reachable" : `http ${res.status}` },
      { status: reachable ? 200 : 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ ok: false, supabase: `unreachable: ${message}` }, { status: 503 });
  }
}
