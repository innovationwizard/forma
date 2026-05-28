/**
 * Budget category settings — Batch 17.
 *
 *   /settings/budget
 *
 * List the 13 BudgetCategory rows with inline edit. Per the audit
 * contract, every change requires a reason + lands an AuditLog row.
 */

import Link from "next/link";

import { BudgetEditRow } from "@/components/settings/BudgetEditRow";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/matrix";
import { decimalString } from "@/lib/calc/currency";
import { formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BudgetSettingsPage() {
  const { role } = await requireRole();
  const canEdit = can(role, "UPDATE", "budget_category");

  const categories = await prisma.budgetCategory.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      budgetAmountUsd: true,
      dashboardVisible: true,
    },
  });
  const total = categories.reduce(
    (acc, c) => acc + Number(decimalString(c.budgetAmountUsd)),
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/settings"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Ajustes
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            CATEGORÍAS DEL PRESUPUESTO
          </h1>
          <p className="text-foreground/40 text-[10px] italic">
            (Editar montos por categoría)
          </p>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          {categories.length} categorías · presupuesto total{" "}
          <strong className="text-foreground tabular-nums">{formatUsd(total)}</strong>.
          Cada edición requiere un motivo y crea una fila de auditoría visible en{" "}
          <Link href="/audit" className="underline">
            /audit
          </Link>
          .
        </p>
        {!canEdit ? (
          <p className="bg-zinc-50 text-foreground/70 mt-3 rounded-md px-3 py-2 text-xs ring-1 ring-zinc-200 ring-inset">
            Tu rol ({role}) es solo lectura sobre este recurso. Las ediciones
            serían rechazadas con <code>403 prohibido</code> del lado del servidor.
          </p>
        ) : null}
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="text-foreground/80 w-full text-sm">
            <thead>
              <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
                <th scope="col" className="py-2 pr-3">Código</th>
                <th scope="col" className="py-2 pr-3">Nombre</th>
                <th scope="col" className="py-2 pr-3 text-right">Actual</th>
                <th scope="col" className="py-2 pr-3">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <BudgetEditRow
                  key={c.id}
                  id={c.id}
                  code={c.code}
                  name={c.name}
                  budgetUsd={decimalString(c.budgetAmountUsd)}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
