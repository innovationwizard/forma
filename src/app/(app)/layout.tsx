import { requireRole } from "@/lib/dal";

/**
 * Auth gate for everything under the `(app)` route group. Every page rendered
 * inside this layout is guaranteed to have a verified, role-assigned user.
 *
 * `requireRole()` is Next 16's recommended DAL pattern (per D20 and the
 * `feedback_nextjs16_auth_pattern` memory):
 *   - Redirects to `/login` if the request has no Supabase session.
 *   - Redirects to `/login?reason=missing-role` if the session has no role
 *     assigned in `app_metadata.role`.
 *   - Otherwise renders the children with the user + role available to
 *     downstream Server Components via the DAL's `cache()`-memoized lookups.
 *
 * Note: no `middleware.ts` / `proxy.ts` is needed for the auth gate. Next 16
 * explicitly discourages middleware-based auth in favor of this pattern.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole();
  return <>{children}</>;
}
