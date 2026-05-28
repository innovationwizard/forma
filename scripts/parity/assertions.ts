/**
 * Batch 18 — End-to-end parity assertion catalog.
 *
 * Single source of truth for every parity claim made against the xlsx by
 * the app. Both `scripts/parity/index.ts` (markdown report) and
 * `tests/parity/*.spec.ts` (vitest suite) consume this list.
 *
 * Conventions:
 *   - `id` is kebab-case, stable across runs (used as section keys in the report).
 *   - `expected` is a STRING — money values are decimal strings ("11228641.51"),
 *     counts are integer strings ("240"). String comparison keeps Decimal-as-string
 *     precision per Rule 8 and avoids JS floating-point.
 *   - `tolerance` is positive USD/GTQ drift allowed (for derived sums that
 *     accumulate per-row rounding). Use 0 for exact matches (counts, labels).
 *   - `sddRef` cites the SDD section + xlsx cell so a reviewer can trace.
 *   - `query` does the Prisma read; keep it minimal — return a string.
 *
 * Adding an assertion: append to the array. Don't reorder existing entries
 * (the report uses the array order for the table; reorderings would churn diffs).
 */

import type { PrismaClient } from "@prisma/client";

export interface Assertion {
  id: string;
  category: string;
  sddRef: string;
  description: string;
  expected: string;
  tolerance: number;
  query: (prisma: PrismaClient) => Promise<string>;
}

export interface AssertionResult {
  id: string;
  category: string;
  description: string;
  sddRef: string;
  expected: string;
  actual: string;
  delta: string;
  tolerance: number;
  pass: boolean;
  error: string | null;
}

const sumDecimal = (values: ReadonlyArray<unknown>): number =>
  values.reduce<number>((a, v) => a + Number(v ?? 0), 0);

const fix = (n: number, d = 2) => n.toFixed(d);

// ── Per-category seed data (SDD §3.2.2 table) ─────────────────────────────

interface CategoryRow {
  code: string;
  name: string;
  budgetUsd: string;
  pct: string;
}

const SDD_CATEGORIES: CategoryRow[] = [
  { code: "TERRENOS", name: "TERRENOS", budgetUsd: "1182597.40", pct: "0.1053" },
  {
    code: "LICENCIAS_Y_PERMISOS",
    name: "LICENCIAS Y PERMISOS",
    budgetUsd: "230688.00",
    pct: "0.0205",
  },
  {
    code: "PLANIFICACION_TECNICA",
    name: "PLANIFICACIÓN TÉCNICA",
    budgetUsd: "107005.00",
    pct: "0.0095",
  },
  {
    code: "CONSTRUCCIONES_COMPLEMENTARIAS",
    name: "CONSTRUCCIONES COMPLEMENTARIAS",
    budgetUsd: "453373.64",
    pct: "0.0404",
  },
  { code: "CONSTRUCCION", name: "CONSTRUCCIÓN", budgetUsd: "7559996.01", pct: "0.6733" },
  { code: "MERCADEO", name: "MERCADEO", budgetUsd: "189594.92", pct: "0.0169" },
  {
    code: "COMISIONES_DE_VENTA",
    name: "COMISIONES DE VENTA (5%)",
    budgetUsd: "631983.07",
    pct: "0.0563",
  },
  {
    code: "HONORARIOS_LEGALES_ESCRITURACION",
    name: "HONORARIOS LEGALES (ESCRITURACIÓN)",
    budgetUsd: "126396.61",
    pct: "0.0113",
  },
  { code: "GASTOS_LEGALES", name: "GASTOS LEGALES", budgetUsd: "126396.61", pct: "0.0113" },
  {
    code: "DEVELOPMENT_FEE_FORMA_CI",
    name: "DEVELOPMENT FEE - Forma CI",
    budgetUsd: "455027.81",
    pct: "0.0405",
  },
  {
    code: "IMPREVISTOS_MISCELANEOS",
    name: "IMPREVISTOS / MISCELÁNEOS",
    budgetUsd: "165582.42",
    pct: "0.0147",
  },
];

function perCategoryAssertions(): Assertion[] {
  return SDD_CATEGORIES.map<Assertion>((c) => ({
    id: `category.${c.code.toLowerCase().replace(/_/g, "-")}.budget`,
    category: "Per-category budgets",
    sddRef: `§3.2.2 / FCFCasas2!H10:H20 row for ${c.name}`,
    description: `BudgetCategory[${c.code}].budgetAmountUsd = $${c.budgetUsd}`,
    expected: c.budgetUsd,
    tolerance: 0.01,
    query: async (prisma) => {
      const cat = await prisma.budgetCategory.findFirst({
        where: { deletedAt: null, code: c.code },
        select: { budgetAmountUsd: true },
      });
      return cat ? Number(cat.budgetAmountUsd).toFixed(2) : "(missing)";
    },
  }));
}

// ── Per-house seed data (SDD §3.2.5 + D29) ───────────────────────────────

interface HouseRow {
  name: string;
  salePrice: string;
  status: "SOLD" | "AVAILABLE";
}

const SDD_HOUSES: HouseRow[] = [
  { name: "Casa 1", salePrice: "974382.43", status: "SOLD" },
  { name: "Casa 2", salePrice: "997255.26", status: "SOLD" },
  { name: "Casa 3", salePrice: "1275000.00", status: "AVAILABLE" },
  { name: "Casa 4", salePrice: "1275000.00", status: "AVAILABLE" },
  { name: "Casa 5", salePrice: "966148.22", status: "SOLD" },
  { name: "Casa 6", salePrice: "1001829.83", status: "SOLD" },
  { name: "Casa 7", salePrice: "960658.74", status: "SOLD" },
  { name: "Casa 8", salePrice: "1300000.00", status: "AVAILABLE" },
  { name: "Casa 9", salePrice: "1350000.00", status: "AVAILABLE" },
  { name: "Casa 10", salePrice: "1350000.00", status: "AVAILABLE" },
  { name: "Casa 11", salePrice: "1189387.01", status: "SOLD" },
];

function perHouseAssertions(): Assertion[] {
  const priceChecks = SDD_HOUSES.map<Assertion>((h) => ({
    id: `house.${h.name.toLowerCase().replace(/\s+/g, "-")}.sale-price`,
    category: "Per-house sale prices",
    sddRef: `§3.2.5 + D29 / FCFCasas2!H row for ${h.name}`,
    description: `RvUnit[${h.name}].salePriceSinIvaUsd = $${h.salePrice}`,
    expected: h.salePrice,
    tolerance: 0.01,
    query: async (prisma) => {
      const u = await prisma.rvUnit.findFirst({
        where: { deletedAt: null, name: h.name },
        select: { salePriceSinIvaUsd: true },
      });
      return u && u.salePriceSinIvaUsd ? Number(u.salePriceSinIvaUsd).toFixed(2) : "(missing)";
    },
  }));
  const statusChecks = SDD_HOUSES.map<Assertion>((h) => ({
    id: `house.${h.name.toLowerCase().replace(/\s+/g, "-")}.status`,
    category: "Per-house status",
    sddRef: `D29 operational override${h.name === "Casa 6" ? " + Q-CASA-6-STATUS pending" : ""}`,
    description: `RvUnit[${h.name}].status = ${h.status}`,
    expected: h.status,
    tolerance: 0,
    query: async (prisma) => {
      const u = await prisma.rvUnit.findFirst({
        where: { deletedAt: null, name: h.name },
        select: { status: true },
      });
      return u ? u.status : "(missing)";
    },
  }));
  return [...priceChecks, ...statusChecks];
}

export const assertions: Assertion[] = [
  // ── Totals (SDD §3.2.1 + §10 Phase 2) ─────────────────────────────────
  {
    id: "totals.budget-sin-iva",
    category: "Totals",
    sddRef: "§10 Phase 2 / FCFCasas2!H22 + Ppto Inversion!H62",
    description: "Σ BudgetCategory.budgetAmountUsd = total budget sin IVA",
    expected: "11228641.51",
    tolerance: 0.10,
    query: async (prisma) => {
      const cats = await prisma.budgetCategory.findMany({
        where: { deletedAt: null },
        select: { budgetAmountUsd: true },
      });
      return fix(sumDecimal(cats.map((c) => c.budgetAmountUsd)));
    },
  },
  {
    id: "totals.budget-pct",
    category: "Totals",
    sddRef: "§3.2.2 / FCFCasas2!I10:I20",
    description: "Σ BudgetCategory.budgetPercentage ≈ 1.0 (sums to 100%)",
    expected: "1.00",
    tolerance: 0.01,
    query: async (prisma) => {
      const cats = await prisma.budgetCategory.findMany({
        where: { deletedAt: null, dashboardVisible: true },
        select: { budgetPercentage: true },
      });
      return fix(sumDecimal(cats.map((c) => c.budgetPercentage)), 4);
    },
  },
  {
    id: "totals.projected-revenue",
    category: "Totals",
    sddRef: "§10 Phase 2 / FCFCasas2!H47",
    description: "Σ RvUnit.salePriceSinIvaUsd = total projected revenue sin IVA",
    expected: "12639661.49",
    tolerance: 0.50,
    query: async (prisma) => {
      const units = await prisma.rvUnit.findMany({
        where: { deletedAt: null },
        select: { salePriceSinIvaUsd: true },
      });
      return fix(sumDecimal(units.map((u) => u.salePriceSinIvaUsd ?? "0")));
    },
  },
  {
    id: "totals.executed-actuals-usd",
    category: "Totals",
    sddRef: "§10 Phase 2 v0.4 N3 / Ppto Inversion!H135 (live)",
    description: "Σ Expenditure.amountUsd + PartnerContribution.amountUsd = $2,001,163.72",
    expected: "2001163.72",
    tolerance: 2.00,
    query: async (prisma) => {
      const [exp, pc] = await Promise.all([
        prisma.expenditure.findMany({
          where: { deletedAt: null },
          select: { amountUsd: true },
        }),
        prisma.partnerContribution.findMany({
          where: { deletedAt: null },
          select: { amountUsd: true },
        }),
      ]);
      const sum =
        sumDecimal(exp.map((e) => e.amountUsd)) + sumDecimal(pc.map((p) => p.amountUsd));
      return fix(sum);
    },
  },
  {
    id: "totals.executed-actuals-gtq",
    category: "Totals",
    sddRef: "§10 Phase 2 / Ppto Inversion!ED71 + Detalle egresos!F5",
    description: "Σ Expenditure.amountSinIva + PartnerContribution.amountGtq = 15,408,960.63 GTQ",
    expected: "15408960.63",
    tolerance: 1.00,
    query: async (prisma) => {
      const [exp, pc] = await Promise.all([
        prisma.expenditure.findMany({
          where: { deletedAt: null },
          select: { amountSinIva: true },
        }),
        prisma.partnerContribution.findMany({
          where: { deletedAt: null },
          select: { amountGtq: true },
        }),
      ]);
      const sum =
        sumDecimal(exp.map((e) => e.amountSinIva)) + sumDecimal(pc.map((p) => p.amountGtq));
      return fix(sum);
    },
  },

  // ── Per-category budgets (SDD §3.2.2 table) ────────────────────────────
  ...perCategoryAssertions(),

  // ── Per-house sale prices (SDD §3.2.5 + parsed FCFCasas2 col H) ────────
  ...perHouseAssertions(),

  // ── RvUnit counts + sold bucket per D29 ────────────────────────────────
  {
    id: "rvunits.count-total",
    category: "Sales",
    sddRef: "§3.2.5 + D29 / FCFCasas2!A33:A43",
    description: "RvUnit count = 11",
    expected: "11",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.rvUnit.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "rvunits.count-sold",
    category: "Sales",
    sddRef: "D29 operational override — sold bucket {1,2,5,6,7,11}",
    description: "RvUnit sold count = 6 (Casa 1, 2, 5, 6, 7, 11)",
    expected: "6",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.rvUnit.count({ where: { deletedAt: null, status: "SOLD" } })).toString(),
  },
  {
    id: "rvunits.count-available",
    category: "Sales",
    sddRef: "D29 / unsold = {3,4,8,9,10}",
    description: "RvUnit available count = 5",
    expected: "5",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.rvUnit.count({
        where: { deletedAt: null, status: "AVAILABLE" },
      })).toString(),
  },

  // ── Monthly projection aggregates (post-EBITDA-D31 + revenue-row fixes) ──
  {
    id: "monthly.count",
    category: "Monthly projections",
    sddRef: "§3.2.6 / FCFCasas2!K5:AT5",
    description: "MonthlyProjection count = 36",
    expected: "36",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.monthlyProjection.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "monthly.sum-cost-sin-iva",
    category: "Monthly projections",
    sddRef: "FCFCasas2!H22 ($11,228,641.51 budget) ≈ Σ K22:AT22 per-month cost",
    description: "Σ MonthlyProjection.totalCostSinIva ≈ $11,228,641.51 (matches budget)",
    expected: "11228641.51",
    tolerance: 1.00,
    query: async (prisma) => {
      const ms = await prisma.monthlyProjection.findMany({
        where: { deletedAt: null },
        select: { totalCostSinIva: true },
      });
      return fix(sumDecimal(ms.map((m) => m.totalCostSinIva)));
    },
  },
  {
    id: "monthly.sum-revenue-sin-iva",
    category: "Monthly projections",
    sddRef: "FCFCasas2!H47 (row 47, sin IVA per-month — post revenue-row fix)",
    description: "Σ MonthlyProjection.totalRevenueSinIva = $12,639,661.49",
    expected: "12639661.49",
    tolerance: 2.10,
    query: async (prisma) => {
      const ms = await prisma.monthlyProjection.findMany({
        where: { deletedAt: null },
        select: { totalRevenueSinIva: true },
      });
      return fix(sumDecimal(ms.map((m) => m.totalRevenueSinIva)));
    },
  },
  {
    id: "monthly.sum-ebitda",
    category: "Monthly projections",
    sddRef: "FCFCasas2!H55 (post EBITDA D31 derivation fix)",
    description: "Σ MonthlyProjection.ebitda = $1,411,021.98 (FCFCasas2!H55, derived K55 = K53 - K54)",
    expected: "1411021.98",
    tolerance: 0.05,
    query: async (prisma) => {
      const ms = await prisma.monthlyProjection.findMany({
        where: { deletedAt: null },
        select: { ebitda: true },
      });
      return fix(sumDecimal(ms.map((m) => m.ebitda)));
    },
  },
  {
    id: "monthly.sum-ebitda-con-iva",
    category: "Monthly projections",
    sddRef: "FCFCasas2!H53 (pre-IVA-SAT EBITDA, populated per-month)",
    description: "Σ MonthlyProjection.ebitdaConIva = $1,385,248.86",
    expected: "1385248.86",
    tolerance: 0.05,
    query: async (prisma) => {
      const ms = await prisma.monthlyProjection.findMany({
        where: { deletedAt: null },
        select: { ebitdaConIva: true },
      });
      return fix(sumDecimal(ms.map((m) => m.ebitdaConIva)));
    },
  },

  // ── Credit facility (SDD §3.2.7 + N1) ─────────────────────────────────
  {
    id: "facility.count",
    category: "Credit facility",
    sddRef: "§3.2.7 / FCFCasas2!H56",
    description: "CreditFacility count = 1 (G&T development drawdown)",
    expected: "1",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.creditFacility.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "facility.cap-usd",
    category: "Credit facility",
    sddRef: "§3.2.7 / FCFCasas2!H56 = $7M",
    description: "CreditFacility.initialCapUsd = $7,000,000",
    expected: "7000000.00",
    tolerance: 0.01,
    query: async (prisma) => {
      const f = await prisma.creditFacility.findFirst({
        where: { deletedAt: null },
        select: { initialCapUsd: true },
      });
      return f ? fix(Number(f.initialCapUsd)) : "(missing)";
    },
  },
  {
    id: "facility.annual-rate",
    category: "Credit facility",
    sddRef: "§3.2.7 / FCFCasas2!H57 = 0.0725",
    description: "CreditFacility.annualRate = 0.0725 (7.25%)",
    expected: "0.0725",
    tolerance: 0.0001,
    query: async (prisma) => {
      const f = await prisma.creditFacility.findFirst({
        where: { deletedAt: null },
        select: { annualRate: true },
      });
      return f ? Number(f.annualRate).toFixed(4) : "(missing)";
    },
  },
  {
    id: "facility.amortization-rule-count",
    category: "Credit facility",
    sddRef: "§3.2.7 / author's note 2 (revolvente híbrido)",
    description: "AmortizationRule count = 1 (revolvente híbrido)",
    expected: "1",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.amortizationRule.count({ where: { deletedAt: null } })).toString(),
  },

  // ── ISR — both rates literal (D34) ─────────────────────────────────────
  {
    id: "isr.count",
    category: "ISR",
    sddRef: "D34 / §3.2.10",
    description: "IsrObligation count = 2 (ISR 18 + ISR 25 literal)",
    expected: "2",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.isrObligation.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "isr.labels",
    category: "ISR",
    sddRef: "D34 + [[feedback_literal_labels_when_multiple_values]]",
    description: "IsrObligation.uiLabel sorted = 'ISR 18, ISR 25' (literal per D34)",
    expected: "ISR 18, ISR 25",
    tolerance: 0,
    query: async (prisma) => {
      const obs = await prisma.isrObligation.findMany({
        where: { deletedAt: null },
        select: { uiLabel: true },
        orderBy: { uiLabel: "asc" },
      });
      return obs.map((o) => o.uiLabel).join(", ");
    },
  },

  // ── Foundational events: PartnerContribution (SDD §3.2.8) ──────────────
  {
    id: "partner-contributions.count",
    category: "Foundational events",
    sddRef: "§3.2.8 / Detalle egresos!row 267 + row 138",
    description: "PartnerContribution count ≥ 2 (2018 IN_KIND_ASSET + 2025 CASH_PURCHASE)",
    expected: "2",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.partnerContribution.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "partner-contributions.in-kind-2018",
    category: "Foundational events",
    sddRef: "Detalle egresos!row 267 (2018-02-15 IN_KIND_ASSET Q9,096,780)",
    description: "PartnerContribution IN_KIND_ASSET row exists (Q9,096,780)",
    expected: "9096780.00",
    tolerance: 0.01,
    query: async (prisma) => {
      const pc = await prisma.partnerContribution.findFirst({
        where: { deletedAt: null, kind: "IN_KIND_ASSET" },
        select: { amountGtq: true },
      });
      return pc ? fix(Number(pc.amountGtq)) : "(missing)";
    },
  },
  {
    id: "partner-contributions.cash-2025",
    category: "Foundational events",
    sddRef: "Detalle egresos!row 138 (2025-06-16 CASH_PURCHASE Q1,535,506)",
    description: "PartnerContribution CASH_PURCHASE row exists (Q1,535,506)",
    expected: "1535506.00",
    tolerance: 0.01,
    query: async (prisma) => {
      const pc = await prisma.partnerContribution.findFirst({
        where: { deletedAt: null, kind: "CASH_PURCHASE" },
        select: { amountGtq: true },
      });
      return pc ? fix(Number(pc.amountGtq)) : "(missing)";
    },
  },

  // ── Bank accounts (Detalle egresos finding #2) ─────────────────────────
  {
    id: "banks.count",
    category: "Bank accounts",
    sddRef: "Detalle egresos finding #2 (9 distinct accounts: 6 active + 3 legacy)",
    description: "BankAccount count = 9",
    expected: "9",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.bankAccount.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "banks.active",
    category: "Bank accounts",
    sddRef: "Detalle egresos finding #2 — 6 active",
    description: "Active BankAccount count = 6",
    expected: "6",
    tolerance: 0,
    query: async (prisma) =>
      (
        await prisma.bankAccount.count({ where: { deletedAt: null, isActive: true } })
      ).toString(),
  },
  {
    id: "banks.legacy",
    category: "Bank accounts",
    sddRef: "Detalle egresos finding #2 — 3 legacy",
    description: "Legacy (isActive=false) BankAccount count = 3",
    expected: "3",
    tolerance: 0,
    query: async (prisma) =>
      (
        await prisma.bankAccount.count({ where: { deletedAt: null, isActive: false } })
      ).toString(),
  },

  // ── Data coverage (counts that prove "no drops" per D31) ───────────────
  {
    id: "coverage.expenditures",
    category: "Coverage",
    sddRef: "Detalle egresos rows 8-271 = 240 valid transactions (2 are PartnerContribution events)",
    description: "Expenditure count = 240 (240 + 2 PC = 242 source rows)",
    expected: "240",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.expenditure.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "coverage.counterparties",
    category: "Coverage",
    sddRef: "Detalle egresos finding #5 — 5 functional categories",
    description: "Partner count = 40 (all distinct Empresa values from Detalle egresos)",
    expected: "40",
    tolerance: 0,
    query: async (prisma) =>
      (await prisma.partner.count({ where: { deletedAt: null } })).toString(),
  },
  {
    id: "coverage.model-notes",
    category: "Coverage",
    sddRef: "D32 / FCFCasas2!A106:A110 (5 verbatim NOTAS)",
    description: "Project.modelNotes count = 5 (verbatim Spanish)",
    expected: "5",
    tolerance: 0,
    query: async (prisma) => {
      const p = await prisma.project.findFirstOrThrow({
        where: { deletedAt: null },
        select: { modelNotes: true },
      });
      const notes = Array.isArray(p.modelNotes) ? p.modelNotes : [];
      return notes.length.toString();
    },
  },
  {
    id: "coverage.budget-categories-dashboard",
    category: "Coverage",
    sddRef: "§3.2.2 / FCFCasas2!A10:A20 (11 dashboard categories per D25)",
    description: "Dashboard-visible BudgetCategory count = 11",
    expected: "11",
    tolerance: 0,
    query: async (prisma) =>
      (
        await prisma.budgetCategory.count({
          where: { deletedAt: null, dashboardVisible: true },
        })
      ).toString(),
  },

  // ── Project metadata (D30) ─────────────────────────────────────────────
  {
    id: "project.locked-tc",
    category: "Project metadata",
    sddRef: "§3.2.1 / Ppto Inversion!G2",
    description: "Project.lockedExchangeRate = 7.7",
    expected: "7.70",
    tolerance: 0.001,
    query: async (prisma) => {
      const p = await prisma.project.findFirstOrThrow({
        where: { deletedAt: null },
        select: { lockedExchangeRate: true },
      });
      return Number(p.lockedExchangeRate).toFixed(2);
    },
  },
  {
    id: "project.iva-rate",
    category: "Project metadata",
    sddRef: "§3.2.1 — Guatemala IVA",
    description: "Project.ivaRate = 0.12 (Guatemala 12%)",
    expected: "0.12",
    tolerance: 0.001,
    query: async (prisma) => {
      const p = await prisma.project.findFirstOrThrow({
        where: { deletedAt: null },
        select: { ivaRate: true },
      });
      return Number(p.ivaRate).toFixed(2);
    },
  },
  {
    id: "project.start-date",
    category: "Project metadata",
    sddRef: "§3.2.1 / FCFCasas2!K5",
    description: "Project.startDate = 2025-05-06",
    expected: "2025-05-06",
    tolerance: 0,
    query: async (prisma) => {
      const p = await prisma.project.findFirstOrThrow({
        where: { deletedAt: null },
        select: { startDate: true },
      });
      return p.startDate.toISOString().slice(0, 10);
    },
  },

  // ── DataQualityFlag inventory (D31 — every anomaly is a flag) ──────────
  {
    id: "flags.count-active",
    category: "Data quality flags",
    sddRef: "D31 — current parser run emits 101 flags",
    description: "Active (non-deleted) DataQualityFlag count = 101 (per parser bundle)",
    expected: "101",
    tolerance: 0,
    query: async (prisma) =>
      (
        await prisma.dataQualityFlag.count({ where: { deletedAt: null } })
      ).toString(),
  },
  {
    id: "flags.casa-6-actionable",
    category: "Data quality flags",
    sddRef: "Q-CASA-6-STATUS / finding #9",
    description: "Casa 6 UNIT_STATUS_CONTRADICTS_REFUND flag exists (ERROR_VISIBLE)",
    expected: "1",
    tolerance: 0,
    query: async (prisma) =>
      (
        await prisma.dataQualityFlag.count({
          where: {
            deletedAt: null,
            kind: "UNIT_STATUS_CONTRADICTS_REFUND",
          },
        })
      ).toString(),
  },

  // ── AuditLog presence (D8) ─────────────────────────────────────────────
  {
    id: "audit.has-import-entries",
    category: "Audit log",
    sddRef: "D8 / SDD §12 — XLSX_IMPORT attribution",
    description: "AuditLog has ≥ 1 IMPORT entry (D8 user attribution)",
    expected: "true",
    tolerance: 0,
    query: async (prisma) => {
      const n = await prisma.auditLog.count({ where: { action: "IMPORT" } });
      return (n >= 1).toString();
    },
  },
];

