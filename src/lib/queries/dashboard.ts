/**
 * Level 0 Dashboard composite query.
 *
 * Single round-trip (one orchestrator function; internally fan-out parallel
 * queries against Prisma). Returns the exact shape the L0 dashboard needs.
 * Batch 8 UI is a thin renderer over this.
 *
 * Per D25 + D27 + D28: the L0 dashboard has three canonical blocks
 * (cost summary, revenue summary, financial bottom line). This query
 * returns one snapshot per block.
 *
 * Per D31: the `anomalies` field surfaces parser-emitted flags with
 * severity counts. Per D34: ISR obligations carry their LITERAL labels.
 */

import type { PrismaClient } from "@prisma/client";

import { anomalySnapshot } from "../calc/anomaly";
import { budgetHealthAll } from "../calc/budget-health";
import { burnRate } from "../calc/burn-rate";
import { creditFacilityState } from "../calc/credit-facility";
import { decimalString } from "../calc/currency";
import { ebitdaSnapshot } from "../calc/ebitda";
import { isrSnapshot } from "../calc/isr";
import { ivaSnapshot } from "../calc/iva";
import { revenue } from "../calc/revenue";
import type {
  AnomalySnapshot,
  BurnRateMetrics,
  CategoryHealth,
  CreditFacilityState,
  EbitdaSnapshot,
  IsrSnapshot,
  IvaSnapshot,
  RevenueMetrics,
} from "../calc/types";

export interface DashboardSnapshot {
  project: {
    id: string;
    name: string;
    startDate: string;
    projectedEndDate: string;
    lockedExchangeRate: string;
    tcBudgetaryLabel: string | null;
    tcEffectiveTerrenoHistorical: string | null;
    ivaRate: string;
    /// Per D32 — 5 verbatim Spanish notes from the workbook author.
    modelNotes: string[];
    /// Per D30 — human-readable history note.
    regulatoryHistoryNote: string | null;
    /// Currently active project month (1-based).
    currentMonth: number;
  };
  /// Block 1 per D25 — cost summary.
  budgetHealth: CategoryHealth[];
  burnRate: BurnRateMetrics;
  /// Block 2 per D27 — revenue summary.
  revenue: RevenueMetrics;
  /// Block 3 per D28 — financial bottom line.
  ebitda: EbitdaSnapshot;
  creditFacility: CreditFacilityState | null;
  iva: IvaSnapshot;
  isr: IsrSnapshot;
  /// Per D31 — anomaly counts for the dashboard's badge layer.
  anomalies: AnomalySnapshot;
}

export async function loadDashboardSnapshot(
  prisma: PrismaClient,
  options: { now?: Date } = {},
): Promise<DashboardSnapshot> {
  const now = options.now ?? new Date();

  // Parallel fan-out — single round-trip from the caller's perspective.
  const [
    project,
    categories,
    expenditures,
    partnerContributions,
    monthlyProjections,
    rvUnits,
    creditFacility,
    appraisal,
    isrObligations,
    flags,
  ] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        startDate: true,
        projectedEndDate: true,
        lockedExchangeRate: true,
        tcBudgetaryLabel: true,
        tcEffectiveTerrenoHistorical: true,
        ivaRate: true,
        modelNotes: true,
        regulatoryHistoryNote: true,
      },
    }),
    prisma.budgetCategory.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        budgetAmountUsd: true,
        dashboardVisible: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.expenditure.findMany({
      where: { deletedAt: null },
      select: {
        categoryId: true,
        amountUsd: true,
        amountSinIva: true,
        ivaAmount: true,
        exchangeRate: true,
        exchangeRateAtTransaction: true,
        date: true,
      },
    }),
    // Per Batch 7.5: PartnerContribution amounts feed into budget-health.
    prisma.partnerContribution.findMany({
      where: { deletedAt: null },
      select: { categoryId: true, amountUsd: true },
    }),
    prisma.monthlyProjection.findMany({
      where: { deletedAt: null },
      select: {
        monthNumber: true,
        monthDate: true,
        ebitda: true,
        ebitdaConIva: true,
        totalCostSinIva: true,
        ivaOnCosts: true,
        totalRevenueSinIva: true,
        creditBalance: true,
        interestPayment: true,
        principalPayment: true,
      },
      orderBy: { monthNumber: "asc" },
    }),
    // Sorted client-side by trailing casa number after the fetch so the L0
    // RevenueBlock reads Casa 1, 2, …, 11 instead of lexical 1, 10, 11, 2, 3.
    prisma.rvUnit.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        salePriceSinIvaUsd: true,
        saleMonth: true,
        deliveryMonth: true,
        engancheRate: true,
      },
    }),
    prisma.creditFacility.findFirst({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        lenderName: true,
        initialCapUsd: true,
        currentCapUsd: true,
        annualRate: true,
        ltcCeiling: true,
      },
    }),
    prisma.appraisal.findFirst({
      where: { deletedAt: null },
      orderBy: { cycleNumber: "desc" },
      select: {
        facilityId: true,
        appraisedValueUsd: true,
        cycleNumber: true,
        appraisalDate: true,
      },
    }),
    prisma.isrObligation.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        uiLabel: true,
        rate: true,
        rateKind: true,
        sourceCell: true,
        paymentPattern: true,
      },
      orderBy: { uiLabel: "asc" },
    }),
    prisma.dataQualityFlag.findMany({
      where: { deletedAt: null },
      select: { kind: true, severity: true, resolvedAt: true },
    }),
  ]);

  const startDate = project.startDate;
  const projectedEndDate = project.projectedEndDate;
  const currentMonth = monthsBetween(startDate, now);
  const totalBudgetSum = categories.reduce(
    (acc, c) => acc + Number(decimalString(c.budgetAmountUsd)),
    0,
  );
  const totalBudgetUsd = totalBudgetSum.toFixed(2);

  // ── Block 1: cost summary ─────────────────────────────────────────────
  const budgetHealth = budgetHealthAll(
    categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      budgetAmountUsd: c.budgetAmountUsd,
      dashboardVisible: c.dashboardVisible,
      sortOrder: c.sortOrder,
    })),
    expenditures,
    { projectMonth: currentMonth },
    partnerContributions, // Batch 7.5: roll PC amounts into matching categories
  );
  const burnRateMetrics = burnRate(expenditures, {
    projectStartDate: startDate,
    projectEndDate: projectedEndDate,
    now,
    totalBudgetUsd,
  });

  // ── Block 2: revenue summary ──────────────────────────────────────────
  // Sort by trailing casa number so the per-unit table reads Casa 1..11 in
  // human order, not the lexical order Postgres returns ({1,10,11,2,3,…}).
  const sortedRvUnits = [...rvUnits].sort((a, b) => {
    const an = trailingNumber(a.name);
    const bn = trailingNumber(b.name);
    if (an != null && bn != null) return an - bn;
    if (an != null) return -1;
    if (bn != null) return 1;
    return a.name.localeCompare(b.name);
  });
  const revenueMetrics = revenue(sortedRvUnits, { projectStartDate: startDate, now });

  // ── Block 3: financial bottom line ────────────────────────────────────
  const ebitda = ebitdaSnapshot(monthlyProjections, totalBudgetUsd);
  const creditFacilityStateValue =
    creditFacility != null
      ? creditFacilityState(creditFacility, {
          latestMonthlyEbitdaUsd: ebitda.latestMonth?.ebitdaUsd ?? "0",
          outstandingBalanceUsd: "0", // SE current snapshot: no drawdowns yet (Ppto Inversion!ED80 = 0)
          latestAppraisal: appraisal,
        })
      : null;
  const ivaMetrics = ivaSnapshot(expenditures, monthlyProjections, {
    lockedExchangeRate: decimalString(project.lockedExchangeRate),
    ivaRate: decimalString(project.ivaRate),
  });
  const isrMetrics = isrSnapshot({
    obligations: isrObligations.map((o) => ({
      uiLabel: o.uiLabel,
      rate: o.rate,
      rateKind: o.rateKind,
      sourceCell: o.sourceCell,
      paymentPattern: o.paymentPattern,
    })),
    monthly: monthlyProjections,
  });

  const anomalies = anomalySnapshot(flags);

  return {
    project: {
      id: project.id,
      name: project.name,
      startDate: project.startDate.toISOString().slice(0, 10),
      projectedEndDate: project.projectedEndDate.toISOString().slice(0, 10),
      lockedExchangeRate: decimalString(project.lockedExchangeRate),
      tcBudgetaryLabel: project.tcBudgetaryLabel,
      tcEffectiveTerrenoHistorical:
        project.tcEffectiveTerrenoHistorical != null
          ? decimalString(project.tcEffectiveTerrenoHistorical)
          : null,
      ivaRate: decimalString(project.ivaRate),
      modelNotes: Array.isArray(project.modelNotes)
        ? project.modelNotes.filter((n): n is string => typeof n === "string")
        : [],
      regulatoryHistoryNote: project.regulatoryHistoryNote,
      currentMonth,
    },
    budgetHealth,
    burnRate: burnRateMetrics,
    revenue: revenueMetrics,
    ebitda,
    creditFacility: creditFacilityStateValue,
    iva: ivaMetrics,
    isr: isrMetrics,
    anomalies,
  };
}

function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

/// Extract the trailing integer from a string like "Casa 1" / "Casa 11".
/// Returns null if no trailing digits — sort logic falls back to lexical.
function trailingNumber(s: string): number | null {
  const m = s.match(/(\d+)\s*$/);
  if (!m || m[1] == null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
