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
      label: "Categorías del presupuesto",
      blurb: "Editar los presupuestos por categoría. Cada cambio requiere motivo + queda auditado.",
      visible: can(role, "READ", "budget_category"),
    },
    {
      href: "/settings/rates",
      label: "Tasas y tipos de cambio",
      blurb: "TC anclado · IVA · tasas de ISR. Base de todos los cálculos.",
      visible: can(role, "READ", "project") || can(role, "READ", "isr_obligation"),
    },
    {
      href: "/audit",
      label: "Registro de actividad",
      blurb: "Auditoría global. Solo lectura por D8.",
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
          ← Volver al tablero
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            AJUSTES
          </h1>
                  </div>
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
