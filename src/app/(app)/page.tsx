/**
 * Level 0 Dashboard — the CEO's one-glance answer to "how are we against
 * the budget?" per SDD §5.
 *
 * Server component: composes `loadDashboardSnapshot` (single round-trip
 * fan-out) and renders three canonical blocks per D25/D27/D28:
 *
 *   Block 1 (cost summary)         — HealthHeader + StatusTiles + CategoryBars
 *   Block 2 (revenue summary)      — RevenueBlock
 *   Block 3 (financial bottom)     — FinancialBottomLine
 *
 * Plus BurnRate + Projection cards and an anomaly strip per D31.
 *
 * Per D25 the CategoryBars render in canonical order (BudgetCategory.sortOrder
 * asc, matching FCFCasas2!A10:I20). Anomalies surface via visual treatment —
 * never by reordering rows.
 */

import Link from "next/link";

import { AnomalyBadges } from "@/components/dashboard/AnomalyBadges";
import { BurnRateCard } from "@/components/dashboard/BurnRateCard";
import { CategoryBars } from "@/components/dashboard/CategoryBars";
import { FinancialBottomLine } from "@/components/dashboard/FinancialBottomLine";
import { HealthHeader } from "@/components/dashboard/HealthHeader";
import { ModelNotes } from "@/components/dashboard/ModelNotes";
import { ProjectionCard } from "@/components/dashboard/ProjectionCard";
import { RevenueBlock } from "@/components/dashboard/RevenueBlock";
import { StatusTiles } from "@/components/dashboard/StatusTiles";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { formatIsoDate } from "@/lib/format";
import { loadDashboardSnapshot } from "@/lib/queries/dashboard";
import { can } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ role }, snapshot, unclassifiedCount] = await Promise.all([
    requireRole(),
    loadDashboardSnapshot(prisma),
    prisma.bankTransaction.count({
      where: { classificationStatus: "UNCLASSIFIED", deletedAt: null },
    }),
  ]);
  const canCreate = can(role, "CREATE", "expenditure");
  const canClassify = can(role, "UPDATE", "bank_transaction");
  const today = new Date();

  const totalBudgetUsd = snapshot.budgetHealth
    .reduce((acc, c) => acc + Number(c.budgetUsd), 0)
    .toString();
  const totalSpentUsd = snapshot.budgetHealth
    .reduce((acc, c) => acc + Number(c.spentUsd), 0)
    .toString();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {snapshot.project.name}
            </h1>
            <p className="text-foreground/60 mt-1 text-sm">
              Mes {snapshot.project.currentMonth} ·{" "}
              {formatIsoDate(snapshot.project.startDate)} →{" "}
              {formatIsoDate(snapshot.project.projectedEndDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-foreground/60 text-sm tabular-nums">
              {today.toLocaleDateString("es-GT", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <Link
              href="/sales"
              className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Ventas
            </Link>
            <Link
              href="/forecast"
              className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Proyección
            </Link>
            <Link
              href="/settings"
              className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Ajustes
            </Link>
            {canClassify ? (
              <Link
                href="/inbox"
                className="border-foreground/20 text-foreground hover:bg-zinc-50 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Bandeja
                {unclassifiedCount > 0 ? (
                  <span className="bg-amber-500 text-background inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                    {unclassifiedCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {canCreate ? (
              <>
                <Link
                  href="/import/new"
                  className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Importar estado
                </Link>
                <Link
                  href="/entry/new"
                  className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium"
                >
                  + Nueva transacción
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <AnomalyBadges anomalies={snapshot.anomalies} />
      </header>

      {/* Block 1 — cost summary per D25 */}
      <HealthHeader totalBudgetUsd={totalBudgetUsd} totalSpentUsd={totalSpentUsd} />
      <StatusTiles categories={snapshot.budgetHealth} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <CategoryBars categories={snapshot.budgetHealth} />
        <div className="flex flex-col gap-4">
          <BurnRateCard burnRate={snapshot.burnRate} />
          <ProjectionCard
            burnRate={snapshot.burnRate}
            totalBudgetUsd={totalBudgetUsd}
          />
        </div>
      </div>

      {/* Block 2 — revenue summary per D27 */}
      <RevenueBlock revenue={snapshot.revenue} />

      {/* Block 3 — financial bottom line per D28 */}
      <FinancialBottomLine
        ebitda={snapshot.ebitda}
        creditFacility={snapshot.creditFacility}
        iva={snapshot.iva}
        isr={snapshot.isr}
      />

      <ModelNotes notes={snapshot.project.modelNotes} />
    </main>
  );
}
