/**
 * Rate overrides — Batch 17.
 *
 *   /settings/rates
 *
 * Edit `Project.lockedExchangeRate` + `Project.ivaRate` + each
 * `IsrObligation.rate`. Every change requires a reason + writes an
 * AuditLog row. D34 mandates the literal labels (`"ISR 18"` / `"ISR 25"`)
 * — preserved verbatim.
 */

import Link from "next/link";

import { IsrRateForm } from "@/components/settings/IsrRateForm";
import { ProjectRatesForm } from "@/components/settings/ProjectRatesForm";
import { decimalString } from "@/lib/calc/currency";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/matrix";
import { formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RatesSettingsPage() {
  const { role } = await requireRole();
  const canEditProject = can(role, "UPDATE", "project");
  const canEditIsr = can(role, "UPDATE", "isr_obligation");

  const [project, isrObligations] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { lockedExchangeRate: true, ivaRate: true },
    }),
    prisma.isrObligation.findMany({
      where: { deletedAt: null },
      orderBy: { uiLabel: "asc" },
      select: { id: true, uiLabel: true, rate: true, sourceCell: true, paymentPattern: true, rateKind: true },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/settings"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Ajustes
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            TASAS Y TIPOS DE CAMBIO
          </h1>
                  </div>
        <p className="text-foreground/60 mt-1 text-sm">
          TC anclado del proyecto, IVA, y tasas de obligaciones de ISR. Base de todos
          los cálculos — los cambios requieren un motivo y se auditan.
        </p>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">TASAS DEL PROYECTO</h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          El TC anclado es el respaldo cuando el TC por transacción no es extractable
          (Detalle egresos finding #11). La tasa de IVA impulsa todas las conversiones
          sin-IVA ↔ con-IVA en la aplicación.
        </p>
        <div className="mt-4">
          <ProjectRatesForm
            initialLockedExchangeRate={decimalString(project.lockedExchangeRate)}
            initialIvaRate={decimalString(project.ivaRate)}
            canEdit={canEditProject}
          />
        </div>
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">OBLIGACIONES DE ISR</h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          Por D34: las etiquetas son <strong>literales</strong> (<code>&quot;ISR 18&quot;</code>{" "}
          / <code>&quot;ISR 25&quot;</code>) — nunca abreviadas a
          &quot;efectiva&quot;/&quot;nominal&quot;. Cada tasa se guarda como decimal
          fraccionario (ej. <code>0.18</code> = 18%).
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {isrObligations.map((o) => (
            <div
              key={o.id}
              className="border-foreground/10 bg-background/50 flex flex-col gap-1 rounded-lg border p-3"
            >
              <div className="text-foreground/50 flex items-center gap-2 text-[10px] tracking-wide uppercase">
                <span>Origen: {o.sourceCell}</span>
                <span>·</span>
                <span>Patrón: {o.paymentPattern.toLowerCase().replace(/_/g, " ")}</span>
                <span>·</span>
                <span>Tipo: {o.rateKind.toLowerCase()}</span>
              </div>
              <div className="text-foreground/60 text-xs">
                Actual: <strong className="text-foreground tabular-nums">{formatPct(decimalString(o.rate))}</strong>
              </div>
              <IsrRateForm
                id={o.id}
                uiLabel={o.uiLabel}
                currentRate={decimalString(o.rate)}
                canEdit={canEditIsr}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
