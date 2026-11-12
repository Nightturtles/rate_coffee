import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { slugExists, type SlugKind } from "@/lib/slugs";

const DETAIL = /^\/(roasters|cafes)\/([^/]+)\/?$/;

/**
 * Two jobs, both of which have to happen before a page starts streaming:
 *
 * 1. Unknown roaster and cafe slugs get a real 404. The detail pages stream, so by the time their own
 *    notFound() runs the 200 is already sent. Rewriting to a path no route matches renders
 *    app/not-found.tsx with a 404 status and leaves the address bar alone.
 * 2. Keeps the Supabase session cookie fresh on every page request so server components can read the
 *    signed-in user without doing the refresh themselves.
 */
export async function proxy(request: NextRequest) {
  const detail = DETAIL.exec(request.nextUrl.pathname);
  if (detail && (request.method === "GET" || request.method === "HEAD") && !(await slugExists(detail[1] as SlugKind, detail[2]))) {
    return NextResponse.rewrite(new URL("/_unknown", request.url));
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  // Verifies the JWT and refreshes it when close to expiry. Do not put logic between client creation and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/health|maplibre-worker\\.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
