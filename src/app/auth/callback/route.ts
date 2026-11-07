import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Finishes a magic-link sign-in. Handles both the PKCE `code` and the `token_hash` link styles. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const db = await createSupabaseServerClient();

  let error: string | null = null;
  if (code) error = (await db.auth.exchangeCodeForSession(code)).error?.message ?? null;
  else if (tokenHash && type) error = (await db.auth.verifyOtp({ token_hash: tokenHash, type })).error?.message ?? null;
  else error = "Missing sign-in token.";

  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
