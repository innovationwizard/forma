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
 *   - `/casa/[id]/reflujo` (Batch 13c — flow-focused per-house view)
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
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Sales</h1>
          <span className="text-foreground/60 text-xs tabular-nums">
            {grid.rows.length} units
          </span>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          Per-house status, buyer linkage, and payments-to-date. Click any
          card for the lifecycle + payment-schedule detail. Reflujo (planned
          vs actual flow) lives separately at <code>/casa/[id]/reflujo</code>.
        </p>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Aggregate</h2>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Total projected" value={formatUsd(totals.totalProjectedUsd)} />
          <Stat label="Total paid" value={formatUsd(totals.totalPaidUsd)} />
          <Stat label="Sold" value={`${totals.unitCountSold} / ${grid.rows.length}`} />
          <Stat label="Available" value={`${totals.unitCountAvailable} / ${grid.rows.length}`} />
          {totals.unitsWithIncompleteData > 0 ? (
            <Stat
              label="Data incomplete"
              value={totals.unitsWithIncompleteData.toString()}
              accent="warning"
            />
          ) : null}
          {totals.unitCountOther > 0 ? (
            <Stat label="Other status" value={totals.unitCountOther.toString()} />
          ) : null}
        </dl>
        <p className="text-foreground/40 mt-3 text-[10px]">
          Total projected reconciles to SDD §3.2.5 ($12,639,661.49).
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
