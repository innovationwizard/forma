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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadSalesGrid, type SalesGridRow } from "@/lib/queries/sales";
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
                      </div>
          <span className="text-foreground/60 text-xs tabular-nums">
            {grid.rows.length} unidades
          </span>
        </div>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">RESUMEN GENERAL</h2>
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
              tooltip={<IncompleteDataTooltip rows={grid.rows.filter((r) => r.dataIncomplete)} />}
              tooltipLabel="Detalle de datos incompletos por casa"
            />
          ) : null}
          {totals.unitCountOther > 0 ? (
            <Stat label="Otros estados" value={totals.unitCountOther.toString()} />
          ) : null}
        </dl>
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
  tooltip,
  tooltipLabel,
}: {
  label: string;
  value: string;
  accent?: "neutral" | "warning";
  /// Optional InfoTooltip body. When supplied, an (i) icon renders to the
  /// right of the value and opens a popover with this content on hover/focus.
  tooltip?: React.ReactNode;
  /// Accessible name for the (i) trigger button. Required when `tooltip` is set.
  tooltipLabel?: string;
}) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd
        className={
          "mt-0.5 flex items-center gap-1.5 text-base font-semibold tabular-nums " +
          (accent === "warning" ? "text-amber-700" : "text-foreground")
        }
      >
        <span>{value}</span>
        {tooltip != null && tooltipLabel != null ? (
          <InfoTooltip label={tooltipLabel}>{tooltip}</InfoTooltip>
        ) : null}
      </dd>
    </div>
  );
}

/// Itemized tooltip body: one block per house with the schema-field-name
/// for each missing column. Field labels are deliberately schema-derived
/// (e.g. `soldAt`, `reservedAt`) — these are not editorial copy, they are
/// 1:1 with database column semantics.
function IncompleteDataTooltip({ rows }: { rows: SalesGridRow[] }) {
  if (rows.length === 0) {
    return <p>Sin datos incompletos.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">
        {rows.length} casa{rows.length === 1 ? "" : "s"} VENDIDA{rows.length === 1 ? "" : "S"} con datos incompletos
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="border-foreground/10 border-t pt-1.5">
            <div className="text-foreground font-medium">{r.name}</div>
            <ul className="text-foreground/70 mt-1 list-disc pl-4">
              {r.missingFields.map((f) => (
                <li key={f}>
                  <code className="text-[10px]">{f}</code>
                  {": "}
                  {MISSING_FIELD_DESCRIPTION[f]}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Plain-Spanish gloss for each schema field name surfaced in the tooltip.
/// These are direct one-line descriptions of the DB column meaning — not
/// marketing or editorial copy.
const MISSING_FIELD_DESCRIPTION: Record<SalesGridRow["missingFields"][number], string> = {
  buyer: "comprador vinculado (Partner). Vincúlalo desde /sales/[id].",
  soldAt: "fecha en que la unidad se marcó como VENDIDA.",
  reservedAt: "fecha en que se registró la reserva inicial.",
  saleMonth: "mes del proyecto en que ocurrió la venta.",
  deliveryMonth: "mes del proyecto en que se entrega la unidad.",
};
