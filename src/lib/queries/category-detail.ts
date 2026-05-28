/**
 * Level 1 — Category-Detail composite query.
 *
 * Single round-trip from the caller's perspective; internally a parallel
 * fan-out via `Promise.all`. Returns the exact shape the L1 page renders.
 *
 * Per Batch 7.5: a category's "events" are both `Expenditure` and
 * `PartnerContribution` rows that map to it (PCs feed into budget-health
 * for TERRENOS today; only TERRENOS has PCs in Santa Elena). The transaction
 * table unifies them with a `kind` discriminator so the CEO sees one
 * chronological list, not two parallel ones.
 *
 * Per D25 we don't reorder anomalies on the L1 view either — the listing
 * is chronological (or user-controlled via URL sort). Anomaly callouts
 * live in the row's status badge and in the Header card.
 */

import type { ExpenditureStatus, Prisma, PrismaClient } from "@prisma/client";

import { budgetHealthAll } from "../calc/budget-health";
import { decimalString } from "../calc/currency";
import type { CategoryHealth } from "../calc/types";

export type EventKind = "EXPENDITURE" | "PARTNER_CONTRIBUTION";

export interface CategoryEventRow {
  id: string;
  kind: EventKind;
  date: string;
  amountUsd: string;
  /// Pre-computed display label for the counterparty:
  ///  - Expenditure → partner.name ?? vendorRaw
  ///  - PartnerContribution → partner.name + " (aportación)"
  counterparty: string;
  description: string;
  status: ExpenditureStatus | "POSTED";
  /// Workbook source ref or null. Useful in the URL for the L2 detail
  /// page and in the audit trail.
  sourceWorkbookRef: string | null;
}

export interface CategoryDetailSnapshot {
  project: {
    startDate: string;
    projectedEndDate: string;
    currentMonth: number;
    totalMonths: number;
    lockedExchangeRate: string;
  };
  category: {
    id: string;
    code: string;
    name: string;
    dashboardVisible: boolean;
    sortOrder: number;
    /// Same shape the L0 dashboard renders for this category.
    health: CategoryHealth;
  };
  subItems: Array<{
    id: string;
    code: string;
    description: string;
    unit: string | null;
    quantity: string | null;
    unitPriceUsd: string | null;
    totalUsd: string;
  }>;
  /// 1-indexed (M1, M2, …) cumulative-spend timeline. Planned curve is a
  /// linear ramp from 0 → budget across the project. Actual curve is the
  /// running sum of all events whose date falls in or before that month.
  /// Events with `date < project.startDate` are bucketed at M0 so they
  /// appear as the starting actual value (see Batch 7.5 TERRENOS PCs).
  timeline: Array<{
    monthNumber: number;
    plannedCumulativeUsd: string;
    actualCumulativeUsd: string;
  }>;
  /// Unified, filtered + sorted event list per the URL parameters.
  events: CategoryEventRow[];
  /// Total event count BEFORE filtering — for the "showing X of Y" line.
  totalEventCount: number;
}

export type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface CategoryDetailParams {
  /// Status filter: matches `Expenditure.status`. `null` = no filter.
  /// `PartnerContribution` rows always pass through (they have no status).
  statusFilter?: ExpenditureStatus | null;
  /// Free-text counterparty substring (case-insensitive). `null` = no filter.
  counterpartySearch?: string | null;
  /// Sort order. Default `date_desc`.
  sort?: SortKey;
}

export async function loadCategoryDetail(
  prisma: PrismaClient,
  code: string,
  params: CategoryDetailParams = {},
  options: { now?: Date } = {},
): Promise<CategoryDetailSnapshot | null> {
  const now = options.now ?? new Date();
  const sort: SortKey = params.sort ?? "date_desc";

  const category = await prisma.budgetCategory.findFirst({
    where: { code, deletedAt: null },
    include: {
      subItems: {
        where: { deletedAt: null },
        orderBy: { code: "asc" },
      },
    },
  });
  if (category == null) return null;

  const [project, expenditures, partnerContributions, allCategoryRows] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: {
        startDate: true,
        projectedEndDate: true,
        lockedExchangeRate: true,
      },
    }),
    prisma.expenditure.findMany({
      where: { categoryId: category.id, deletedAt: null },
      select: {
        id: true,
        date: true,
        amountUsd: true,
        amountSinIva: true,
        ivaAmount: true,
        exchangeRate: true,
        exchangeRateAtTransaction: true,
        description: true,
        descriptionNormalized: true,
        status: true,
        sourceWorkbookRef: true,
        vendorRaw: true,
        categoryId: true,
        partner: { select: { id: true, name: true } },
      },
    }),
    prisma.partnerContribution.findMany({
      where: { categoryId: category.id, deletedAt: null },
      select: {
        id: true,
        date: true,
        amountUsd: true,
        kind: true,
        assetDescription: true,
        notes: true,
        sourceWorkbookRef: true,
        categoryId: true,
        partner: { select: { id: true, name: true } },
      },
    }),
    // For BUDGET-HEALTH calc we need ALL categories' expenditures rolled up;
    // the helper expects the same input shape as the L0 dashboard. We feed
    // only this category's rows because health is computed per-row and
    // doesn't cross-pollinate.
    prisma.budgetCategory.findFirst({
      where: { id: category.id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        budgetAmountUsd: true,
        dashboardVisible: true,
        sortOrder: true,
      },
    }),
  ]);

  const startDate = project.startDate;
  const endDate = project.projectedEndDate;
  const currentMonth = monthsBetween(startDate, now);
  const totalMonths = Math.max(1, monthsBetween(startDate, endDate));

  // ── Health (reuses Batch 7 calc) ─────────────────────────────────────
  if (allCategoryRows == null) return null;
  const [health] = budgetHealthAll(
    [allCategoryRows],
    expenditures,
    { projectMonth: currentMonth },
    partnerContributions,
  );
  if (health == null) return null;

  // ── Unified event list ───────────────────────────────────────────────
  const allEvents: CategoryEventRow[] = [
    ...expenditures.map((e): CategoryEventRow => ({
      id: e.id,
      kind: "EXPENDITURE",
      date: toIso(e.date),
      amountUsd: decimalString(e.amountUsd),
      counterparty: e.partner?.name ?? e.vendorRaw,
      description: e.description,
      status: e.status,
      sourceWorkbookRef: e.sourceWorkbookRef,
    })),
    ...partnerContributions.map((pc): CategoryEventRow => ({
      id: pc.id,
      kind: "PARTNER_CONTRIBUTION",
      date: toIso(pc.date),
      amountUsd: decimalString(pc.amountUsd),
      counterparty: `${pc.partner?.name ?? "(unknown partner)"} · ${pc.kind.replace(/_/g, " ").toLowerCase()}`,
      description: pc.assetDescription ?? pc.notes ?? `${pc.kind} contribution`,
      status: "POSTED",
      sourceWorkbookRef: pc.sourceWorkbookRef,
    })),
  ];

  const totalEventCount = allEvents.length;

  // ── Filter + sort ────────────────────────────────────────────────────
  let filtered = allEvents;
  if (params.statusFilter != null) {
    filtered = filtered.filter(
      (e) => e.kind === "PARTNER_CONTRIBUTION" || e.status === params.statusFilter,
    );
  }
  if (params.counterpartySearch != null && params.counterpartySearch.length > 0) {
    const needle = params.counterpartySearch.toLowerCase();
    filtered = filtered.filter((e) =>
      e.counterparty.toLowerCase().includes(needle) ||
      e.description.toLowerCase().includes(needle),
    );
  }
  filtered.sort(eventComparator(sort));

  // ── Timeline (cumulative planned vs actual, monthly) ─────────────────
  const timeline = buildTimeline({
    events: allEvents,
    startDate,
    totalMonths,
    budgetUsd: decimalString(category.budgetAmountUsd),
  });

  return {
    project: {
      startDate: toIso(startDate),
      projectedEndDate: toIso(endDate),
      currentMonth,
      totalMonths,
      lockedExchangeRate: decimalString(project.lockedExchangeRate),
    },
    category: {
      id: category.id,
      code: category.code,
      name: category.name,
      dashboardVisible: category.dashboardVisible,
      sortOrder: category.sortOrder,
      health,
    },
    subItems: category.subItems.map((si) => ({
      id: si.id,
      code: si.code,
      description: si.description,
      unit: si.unit,
      quantity: si.quantity != null ? decimalString(si.quantity) : null,
      unitPriceUsd: si.unitPriceUsd != null ? decimalString(si.unitPriceUsd) : null,
      totalUsd: decimalString(si.totalUsd),
    })),
    timeline,
    events: filtered,
    totalEventCount,
  };
}

function buildTimeline(args: {
  events: CategoryEventRow[];
  startDate: Date;
  totalMonths: number;
  budgetUsd: string;
}): CategoryDetailSnapshot["timeline"] {
  const budget = Number(args.budgetUsd);
  const months = args.totalMonths;
  const startMs = args.startDate.getTime();

  // Bucket events by month-from-start (events before start go to month 0).
  const buckets = new Map<number, number>();
  for (const e of args.events) {
    const eventDate = new Date(`${e.date}T00:00:00Z`);
    const m = monthsBetween(args.startDate, eventDate);
    const bucket = eventDate.getTime() < startMs ? 0 : m;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + Number(e.amountUsd));
  }

  const out: CategoryDetailSnapshot["timeline"] = [];
  let actualCumulative = 0;

  // M0 represents "pre-project carryover" — show as the starting baseline.
  const carryover = buckets.get(0) ?? 0;
  actualCumulative = carryover;

  for (let i = 1; i <= months; i++) {
    actualCumulative += buckets.get(i) ?? 0;
    const planned = (budget * i) / months;
    out.push({
      monthNumber: i,
      plannedCumulativeUsd: planned.toFixed(2),
      actualCumulativeUsd: actualCumulative.toFixed(2),
    });
  }
  return out;
}

function eventComparator(sort: SortKey): (a: CategoryEventRow, b: CategoryEventRow) => number {
  switch (sort) {
    case "date_asc":
      return (a, b) => a.date.localeCompare(b.date);
    case "amount_desc":
      return (a, b) => Number(b.amountUsd) - Number(a.amountUsd);
    case "amount_asc":
      return (a, b) => Number(a.amountUsd) - Number(b.amountUsd);
    case "date_desc":
    default:
      return (a, b) => b.date.localeCompare(a.date);
  }
}

function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Re-export Prisma's enum so the page can type its URL parser without
// pulling it from `@prisma/client` directly (the page is a thin renderer).
export type { ExpenditureStatus, Prisma };
