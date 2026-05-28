/**
 * Settings index — Batch 17.
 *
 *   /settings
 *
 * Hub for the admin overrides. User management (`/settings/users`) is
 * deferred — needs Supabase Auth integration that's better tackled
 * during Batch 19 deploy.
 */

import Link from "next/link";

import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  const { role } = await requireRole();

  const tiles = [
    {
      href: "/settings/budget",
      label: "Budget categories",
      blurb: "Edit category budgets. Each change requires a reason + audited.",
      visible: can(role, "READ", "budget_category"),
    },
    {
      href: "/settings/rates",
      label: "Rates",
      blurb: "Locked TC · IVA · ISR obligation rates. Foundational to every calc.",
      visible: can(role, "READ", "project") || can(role, "READ", "isr_obligation"),
    },
    {
      href: "/audit",
      label: "Activity log",
      blurb: "Global audit-log browser. Read-only per D8.",
      visible: can(role, "READ", "audit_log"),
    },
  ].filter((t) => t.visible);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-foreground/60 mt-1 text-sm">
          Admin overrides for project parameters. User management lives in
          the Supabase dashboard until Batch 19 ships a wrapper UI.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-foreground/10 bg-card text-card-foreground hover:shadow-md flex flex-col gap-2 rounded-2xl border p-5 shadow-sm transition-shadow"
          >
            <h2 className="text-foreground text-base font-semibold">{t.label}</h2>
            <p className="text-foreground/60 text-xs">{t.blurb}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
