/**
 * Shared types for the SDD §7 calculation layer.
 *
 * Conventions:
 *   - Money is `Decimal` (Prisma type) on the way in, `number` only inside
 *     pure-function bodies, `string` (decimal-as-string) on the way out via
 *     `decimalToString` helpers in `currency.ts`. Per `_THE_RULES.MD` Rule 8.
 *   - Currency: where ambiguous, both `usd` + `gtq` are returned. Per D31
 *     (provenance disclosure) every value the UI shows is anchored to a
 *     source (raw vs recomputed).
 */

import type { Prisma } from "@prisma/client";

export type BudgetHealthStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OVER_BUDGET"
  | "DELAYED"
  | "NOT_STARTED";

export interface CategoryHealth {
  /// Stable identifier (matches `BudgetCategory.code`).
  code: string;
  name: string;
  budgetUsd: string;
  spentUsd: string;
  remainingUsd: string;
  /// Fractional in [0, ∞). 1.0 = exactly on budget; > 1.0 = over.
  pctConsumed: string;
  status: BudgetHealthStatus;
  /// `true` for dashboard-visible (anomaly-detector) categories per D25 + SDD §2.1.
  /// `false` for predictable categories (IMPUESTOS, TRASLADOS) hidden from L0.
  dashboardVisible: boolean;
  sortOrder: number;
}

export interface BurnRateMetrics {
  /// Total expenditures (USD) divided by months active so far.
  monthlyBurnUsd: string;
  /// Average over the trailing 3 months.
  trailing3moUsd: string;
  /// Projected total at end of project: spent + (remaining_months × trailing3mo).
  projectedTotalUsd: string;
  /// True if projected_total ≤ budget × 1.05.
  onBudgetProjection: boolean;
  monthsActive: number;
  monthsRemaining: number;
}

export interface RevenueMetrics {
  /// Total projected revenue across all RvUnits (sin IVA).
  totalProjectedSinIvaUsd: string;
  /// Realized so far — revenue tied to RvUnits with status=SOLD whose
  /// deliveryMonth is in the past (or, in the absence of delivery
  /// timestamps, an estimate based on month-by-month projections).
  realizedToDateUsd: string;
  unitCountSold: number;
  unitCountAvailable: number;
  /// Per-unit revenue projection for the dashboard.
  perUnit: Array<{
    id: string;
    name: string;
    salePriceSinIvaUsd: string;
    status: string;
    saleMonth: number | null;
    deliveryMonth: number | null;
  }>;
}

export interface EbitdaSnapshot {
  /// Sum of all monthly EBITDA values from MonthlyProjection rows (post-IVA).
  totalEbitdaUsd: string;
  /// Sum of all monthly EBITDA values con IVA.
  totalEbitdaConIvaUsd: string;
  /// EBITDA margin: totalEbitda / total budget sin IVA.
  marginPct: string;
  /// Snapshot for the most-recent month with computed EBITDA.
  latestMonth: {
    monthNumber: number;
    monthDate: string;
    ebitdaUsd: string;
  } | null;
}

export interface CreditFacilityState {
  /// Per D33: a CreditFacility carries 1-to-many `AmortizationRule`s.
  /// This snapshot reflects the current rule + current balance + headroom.
  facilityId: string;
  lenderName: string;
  initialCapUsd: string;
  currentBalanceUsd: string;
  /// Most-recent monthly EBITDA — drives the revolvente híbrido principal
  /// payment per author's note 2: principal pays down ONLY when EBITDA > 0.
  monthlyInterestUsd: string;
  monthlyPrincipalPaymentUsd: string;
  /// Current LTC (balance / latest appraisal). May exceed ltcCeiling per
  /// Q-LTC-CEILING (real + normal dynamic capital structure).
  currentLtc: string;
  ltcCeiling: string;
  /// `true` when current LTC > ltcCeiling — drives the dashboard's
  /// "stress zone" visual flag per Q-LTC-CEILING (informational, NOT
  /// alarm).
  inStressZone: boolean;
}

export interface IvaSnapshot {
  /// IVA collected on sales (Cobrado) — sum across MonthlyProjection.
  ivaCobradoUsd: string;
  /// IVA paid on purchases (Pagado) — sum of Expenditure.ivaAmount converted.
  ivaPagadoUsd: string;
  /// Net IVA payable to SAT (cobrado − pagado).
  netIvaPayableUsd: string;
}

export interface CurrencyVariance {
  /// Difference between the actual TC at transaction time and the project's
  /// locked TC, multiplied by the GTQ amount. Per SDD §7.7 v0.4.
  totalVarianceUsd: string;
  /// Per-transaction breakdown for top-N largest variance contributors.
  topContributors: Array<{
    sourceWorkbookRef: string;
    counterpartyName: string;
    actualTc: string;
    lockedTc: string;
    varianceUsd: string;
  }>;
}

export interface IsrSnapshot {
  /// Per D34: literal "ISR 18" and "ISR 25" labels surfaced as-is.
  obligations: Array<{
    uiLabel: string; // "ISR 18" / "ISR 25"
    rate: string;
    sourceCell: string;
    appliedIfPattern: "LUMP_END" | "QUARTERLY" | "ANNUAL" | "CUSTOM_TRIGGER" | "COMPOSITE";
  }>;
  /// Projected ISR amount using the EFFECTIVE rate (default for forecast).
  /// Per Q-ISR-TIMING this is the model's "lump-end at month 36" amount.
  projectedTotalIsrUsd: string;
  /// What the dashboard displays when the effective rate is applied — the
  /// pre-tax profit basis (from monthly projections), times rate.
  preTaxProfitBasisUsd: string;
}

export interface AnomalySnapshot {
  /// Per D31: dashboard shows the count of unresolved flags per severity.
  /// Resolved flags stay in the audit trail but aren't surfaced.
  countsBySeverity: Record<"INFO" | "WARNING" | "ERROR_VISIBLE" | "ERROR_BLOCKING", number>;
  countsByKind: Record<string, number>;
  /// `true` when at least one ERROR_VISIBLE or ERROR_BLOCKING flag is open.
  hasActionableAnomalies: boolean;
}

// ── Input shapes (Prisma row subsets used by the calc functions) ────────────

export type CategoryRow = Pick<
  Prisma.BudgetCategoryGetPayload<Record<string, never>>,
  "code" | "name" | "budgetAmountUsd" | "dashboardVisible" | "sortOrder"
>;

export type ExpenditureRow = Pick<
  Prisma.ExpenditureGetPayload<Record<string, never>>,
  "categoryId" | "amountUsd" | "amountSinIva" | "ivaAmount" | "exchangeRate" | "exchangeRateAtTransaction" | "date"
>;

export type MonthlyProjectionRow = Pick<
  Prisma.MonthlyProjectionGetPayload<Record<string, never>>,
  | "monthNumber"
  | "monthDate"
  | "ebitda"
  | "ebitdaConIva"
  | "totalCostSinIva"
  | "ivaOnCosts"
  | "totalRevenueSinIva"
  | "creditBalance"
  | "interestPayment"
  | "principalPayment"
>;
