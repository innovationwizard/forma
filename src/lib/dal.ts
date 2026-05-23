import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { roleSchema, type Role } from "@/lib/rbac/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer for authentication and the user's role.
 *
 * This is the canonical Next 16 auth pattern per decision D20 and the
 * `feedback_nextjs16_auth_pattern` memory: a small module of `cache()`-wrapped
 * functions called from Server Components, Server Actions, and Route
 * Handlers. Replaces the older `middleware.ts` + `requireUser()` design.
 *
 * Why `cache()`: a single render pass may call `verifySession()` from the
 * layout, then `getUser()` from a server component inside the layout, then
 * `getRole()` from a server action triggered by that component. `cache()`
 * memoizes within the render pass so Supabase is hit at most once per
 * request, not three times.
 *
 * Why `supabase.auth.getUser()` instead of `getSession()`: `getUser()`
 * re-verifies the JWT against Supabase's signing keys server-side. `getSession()`
 * trusts whatever the cookie says, which a hostile client can forge. Auth
 * decisions in this codebase MUST use `getUser()`.
 */

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * Asserts the request is authenticated. Redirects to `/login` if not.
 * Returns the authenticated user otherwise. Idiomatic usage:
 *
 *   const user = await verifySession();
 *
 * at the top of `app/(app)/layout.tsx` and any Server Action that mutates.
 */
export const verifySession = cache(async (): Promise<User> => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Resolves the role of the current user from Supabase Auth's `app_metadata`.
 * `app_metadata` is server-controlled (only Supabase service role can write
 * it), which makes it the right place to store authorization claims.
 *
 * Returns `null` if there's no user OR the user has no role / an unknown
 * role. Callers should treat `null` as "deny everything" (closed by default,
 * consistent with `can()` in the matrix).
 */
export const getRole = cache(async (): Promise<Role | null> => {
  const user = await getUser();
  if (!user) return null;
  const parsed = roleSchema.safeParse(user.app_metadata?.["role"]);
  return parsed.success ? parsed.data : null;
});

/**
 * Combined gate: verifies the session AND requires a role to be set.
 * Use this from any route inside `(app)/` that needs role-aware rendering.
 * If a user is authenticated but has no role assigned (e.g., a Supabase user
 * created via the dashboard with no `app_metadata.role`), they're redirected
 * to `/login?reason=missing-role` so we don't show them an empty app shell.
 */
export const requireRole = cache(async (): Promise<{ user: User; role: Role }> => {
  const user = await verifySession();
  const role = await getRole();
  if (!role) redirect("/login?reason=missing-role");
  return { user, role };
});
