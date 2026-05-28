/**
 * Sales tracker grid — Batch 15.
 *
 *   /sales
 *
 * 11 house cards in canonical name order. Header shows aggregate totals
 * that reconcile to SDD §3.2.5 ($12,639,661.49).
 *
 * Complementary to:
 *   - L0 dashboard's Revenue block (one-glance per-unit table)
 *   - `/casa/[id]/conciliacion` (Batch 13c — flow-focused per-house view)
 *
 * This grid is the buyer/lifecycle-focused entry point: status counts,
 * data-incomplete badges, click into per-unit detail with status actions.
 */

import Link from "next/link";

import { HouseCard } from "@/components/sales/HouseCard";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadSalesGrid } from "@/lib/queries/sales";
import { formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SalesGridPage() {
  await requireRole();
  const grid = await loadSalesGrid(prisma);
  const { totals } = grid;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Volver al tablero
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">VENTAS</h1>
            <p className="text-foreground/40 text-[10px] italic">
              (Estado y pagos por unidad)
            </p>
          </div>
          <span className="text-foreground/60 text-xs tabular-nums">
            {grid.rows.length} unidades
          </span>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          Estado por casa, vinculación con el comprador, y pagos recibidos a la fecha.
          Haz clic en cualquier tarjeta para ver el ciclo y el calendario de pagos.
        </p>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">RESUMEN GENERAL</h2>
          <p className="text-foreground/40 text-[10px] italic">(Totales agregados de ventas)</p>
        </div>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Total proyectado" value={formatUsd(totals.totalProjectedUsd)} />
          <Stat label="Total pagado" value={formatUsd(totals.totalPaidUsd)} />
          <Stat label="Vendidas" value={`${totals.unitCountSold} / ${grid.rows.length}`} />
          <Stat label="Disponibles" value={`${totals.unitCountAvailable} / ${grid.rows.length}`} />
          {totals.unitsWithIncompleteData > 0 ? (
            <Stat
              label="Datos incompletos"
              value={totals.unitsWithIncompleteData.toString()}
              accent="warning"
            />
          ) : null}
          {totals.unitCountOther > 0 ? (
            <Stat label="Otros estados" value={totals.unitCountOther.toString()} />
          ) : null}
        </dl>
        <p className="text-foreground/40 mt-3 text-[10px]">
          Total proyectado reconcilia con SDD §3.2.5 ($12,639,661.49).
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grid.rows.map((row) => (
          <HouseCard key={row.id} row={row} />
        ))}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "warning";
}) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd
        className={
          "mt-0.5 text-base font-semibold tabular-nums " +
          (accent === "warning" ? "text-amber-700" : "text-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}
