import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";

/**
 * Returns a server-side Supabase client bound to the current request's
 * cookies. Use this inside Server Components, Server Actions, and Route
 * Handlers. Each call returns a fresh client — do NOT memoize at module scope.
 *
 * The cookie store comes from Next 16's async `cookies()`. The `setAll`
 * handler is wrapped in try/catch because Supabase's auth library may attempt
 * to refresh + persist tokens from Server Component context, where cookie
 * writes are disallowed by Next. The DAL handles real refreshes via the
 * `proxy` boundary (or Route Handlers) so swallowing the error here is safe.
 */
export async function createClient(): Promise<ReturnType<typeof createServerClient>> {
  const cookieStore = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Setting cookies from a Server Component is a no-op in Next.js.
            // Real session refreshes happen in Route Handlers / Server Actions,
            // where the cookieStore is writable.
          }
        },
      },
    },
  );
}
