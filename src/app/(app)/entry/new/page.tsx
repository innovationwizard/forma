/**
 * Manual transaction entry — Batch 12.
 *
 *   /entry/new
 *
 * Server component. Role-gates BEFORE loading any data: a CEO who lands
 * here gets the view-only stub, not the form. The server actions also
 * re-check `can(role, "CREATE", "expenditure")` so a forged submission
 * is rejected even if this UI check is bypassed.
 *
 * On success the action redirects to `/transaction/[newId]` — the analyst
 * lands on the L2 detail page with the fresh AuditLog row visible.
 */

import Link from "next/link";

import { NewExpenditureForm } from "@/components/entry/NewExpenditureForm";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { loadEntryFormChoices } from "@/lib/queries/entry-form";
import { can } from "@/lib/rbac/matrix";
import { decimalString } from "@/lib/calc/currency";

export const dynamic = "force-dynamic";

export default async function NewExpenditurePage() {
  const { role } = await requireRole();
  const canCreate = can(role, "CREATE", "expenditure");

  if (!canCreate) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <Link
            href="/"
            className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            ← Volver al tablero
          </Link>
          <div className="mt-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              NUEVA TRANSACCIÓN
            </h1>
            <p className="text-foreground/40 text-[10px] italic">
              (Registrar gasto manualmente)
            </p>
          </div>
          <p className="text-foreground/70 mt-3 text-sm">
            Tu rol ({role}) no puede crear gastos. Esto se aplica del lado del
            servidor — los botones no solo están ocultos, el endpoint de mutación
            responderá <code>403 prohibido</code> para tu rol.
          </p>
        </section>
      </main>
    );
  }

  const [choices, project] = await Promise.all([
    loadEntryFormChoices(prisma),
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { lockedExchangeRate: true },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            NUEVA TRANSACCIÓN
          </h1>
          <p className="text-foreground/40 text-[10px] italic">
            (Registrar gasto manualmente)
          </p>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          Registra un gasto manual. Origen = MANUAL, Estado = PENDIENTE.
          El tipo de cambio BANGUAT se resuelve automáticamente por fecha;
          puedes sobrescribirlo dando un motivo obligatorio para la auditoría.
        </p>
      </header>

      <NewExpenditureForm
        choices={choices}
        defaultExchangeRate={decimalString(project.lockedExchangeRate)}
      />
    </main>
  );
}
