import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/**
 * Returns a browser-side Supabase client. Safe to call from Client Components.
 * Reuses the same cookie store as the server client so sessions are shared
 * across the SSR boundary.
 */
export function createClient(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
