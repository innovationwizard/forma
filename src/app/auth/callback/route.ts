import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback handler.
 *
 * Hit by:
 *  - Email confirmation links ("Confirm your email")
 *  - Magic-link sign-in
 *  - OAuth provider redirects (Google, Microsoft, etc. — future SSO per D9)
 *
 * The query string carries either a `code` (PKCE flow) or token fragments
 * Supabase already handled in the browser. For the code-exchange path we
 * trade the code for a session and persist the cookies, then redirect to
 * `next` (defaulting to `/`). On failure we send the user back to `/login`
 * with a `reason` so the UI can render a meaningful message.
 *
 * Direct password sign-in (`signInWithPassword` in /login) does NOT go
 * through this route — Supabase sets cookies in-place from the Server
 * Action.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?reason=callback-no-code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?reason=callback-failed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
