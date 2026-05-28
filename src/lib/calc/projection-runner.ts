/**
 * 36-month projection runner — Batch 16a (read-only).
 *
 * Pure function. Takes the per-month inputs (already typed in
 * `MonthlyProjection` rows) and computes the derived series + 4 return
 * metrics per D28:
 *
 *   1. Revenue-to-cost ratio                    `cumRevenue / cumCost`
 *   2. EBITDA margin                            `totalEbitda / totalCost`
 *   3. Annualized IRR (12 × monthly IRR of EBITDA series)
 *   4. Return on peak equity                    `totalEbitda / peakEquity`
 *
 * Per D28 NONE of these is labeled simply "ROI" anywhere in the UI — the
 * literal disambiguating tokens stay (`feedback_literal_labels_when_multiple_values`).
 *
 * Per Q-TIRI-WINDOW: the xlsx's IRR formula truncates at M30 (`I97 =
 * IRR(K95:AN95, 0) * 12 = 21.23%`). We compute BOTH:
 *   - The 36-month corrected IRR (`irrAnnualizedFull` = ~31.2%)
 *   - The 30-month xlsx-as-written IRR (`irrAnnualizedXlsx` = ~21.23%)
 * The UI surfaces both with a discrepancy badge per D31.
 *
 * IRR implementation: Newton-Raphson with a Brent-style fallback. Stable
 * for the EBITDA series Santa Elena has (mostly negative early, positive
 * late). Returns null when the series doesn't have at least one sign
 * change (no root exists) — caller renders "—" + a flag.
 */

import type { Prisma } from "@prisma/client";

import { decimalString } from "./currency";

export interface ProjectionInputRow {
  monthNumber: number;
  monthDate: string; // ISO YYYY-MM-DD
  costSinIvaUsd: string;
  ivaOnCostsUsd: string;
  costConIvaUsd: string;
  revenueSinIvaUsd: string;
  ebitdaUsd: string;
  ebitdaConIvaUsd: string;
  creditBalanceUsd: string;
  interestPaymentUsd: string;
  principalPaymentUsd: string;
}

export interface ProjectionDerivedRow extends ProjectionInputRow {
  cumulativeCostSinIvaUsd: string;
  cumulativeRevenueSinIvaUsd: string;
  cumulativeEbitdaUsd: string;
  /// Peak equity contribution-to-date at this month: cumulative negative
  /// EBITDA reaching its trough. The most-negative value across months is
  /// the peak equity required.
  cumulativeEbitdaLowwaterUsd: string;
}

export interface ReturnMetrics {
  /// (1) Revenue / Cost ratio per D28. Render as "1.13×" + "+12.6% above cost".
  revenueToCostRatio: string;
  revenueToCostMarginPct: string;
  /// (2) EBITDA margin per D28. Render as "12.6%" with the LITERAL label
  /// "EBITDA margin" — never abbreviated to "ROI".
  ebitdaMarginPct: string;
  /// (3a) Annualized IRR — corrected, over full 36 months.
  /// Returned as a fractional percentage string (e.g. "0.312" for 31.2%).
  /// null when the EBITDA series has no sign change.
  irrAnnualizedFull: string | null;
  /// (3b) Annualized IRR — xlsx as-written, truncated at M30 per
  /// Q-TIRI-WINDOW. Same null semantics.
  irrAnnualizedXlsx: string | null;
  /// (4) Return on peak equity = total EBITDA / peak equity (absolute
  /// value of lowest cumulative EBITDA).
  returnOnPeakEquity: string;
  peakEquityUsd: string;
}

export interface ProjectionResult {
  rows: ProjectionDerivedRow[];
  totals: {
    totalCostSinIvaUsd: string;
    totalRevenueSinIvaUsd: string;
    totalEbitdaUsd: string;
    totalIvaOnCostsUsd: string;
  };
  returns: ReturnMetrics;
}

export type ProjectionInputDb = Pick<
  Prisma.MonthlyProjectionGetPayload<Record<string, never>>,
  | "monthNumber"
  | "monthDate"
  | "totalCostSinIva"
  | "ivaOnCosts"
  | "totalCostConIva"
  | "totalRevenueSinIva"
  | "ebitda"
  | "ebitdaConIva"
  | "creditBalance"
  | "interestPayment"
  | "principalPayment"
>;

/// Convert raw `MonthlyProjection` rows from Prisma → typed input shape.
export function fromDbRows(rows: ProjectionInputDb[]): ProjectionInputRow[] {
  return rows
    .slice()
    .sort((a, b) => a.monthNumber - b.monthNumber)
    .map((r) => ({
      monthNumber: r.monthNumber,
      monthDate: r.monthDate.toISOString().slice(0, 10),
      costSinIvaUsd: decimalString(r.totalCostSinIva),
      ivaOnCostsUsd: decimalString(r.ivaOnCosts),
      costConIvaUsd: decimalString(r.totalCostConIva),
      revenueSinIvaUsd: decimalString(r.totalRevenueSinIva),
      ebitdaUsd: decimalString(r.ebitda),
      ebitdaConIvaUsd: decimalString(r.ebitdaConIva),
      creditBalanceUsd: decimalString(r.creditBalance),
      interestPaymentUsd: decimalString(r.interestPayment),
      principalPaymentUsd: decimalString(r.principalPayment),
    }));
}

export function runProjection(rows: ProjectionInputRow[]): ProjectionResult {
  const sorted = [...rows].sort((a, b) => a.monthNumber - b.monthNumber);

  let cumCost = 0;
  let cumRevenue = 0;
  let cumEbitda = 0;
  let lowwater = 0; // most-negative cumEbitda observed

  const derived: ProjectionDerivedRow[] = sorted.map((r) => {
    cumCost += Number(r.costSinIvaUsd);
    cumRevenue += Number(r.revenueSinIvaUsd);
    cumEbitda += Number(r.ebitdaUsd);
    if (cumEbitda < lowwater) lowwater = cumEbitda;
    return {
      ...r,
      cumulativeCostSinIvaUsd: cumCost.toFixed(2),
      cumulativeRevenueSinIvaUsd: cumRevenue.toFixed(2),
      cumulativeEbitdaUsd: cumEbitda.toFixed(2),
      cumulativeEbitdaLowwaterUsd: lowwater.toFixed(2),
    };
  });

  const totalCost = cumCost;
  const totalRevenue = cumRevenue;
  const totalEbitda = cumEbitda;
  const totalIva = sorted.reduce((acc, r) => acc + Number(r.ivaOnCostsUsd), 0);

  // Returns
  const revenueToCostRatio = totalCost > 0 ? totalRevenue / totalCost : 0;
  const ebitdaMargin = totalCost > 0 ? totalEbitda / totalCost : 0;
  const peakEquity = Math.abs(lowwater);
  const returnOnPeakEquity = peakEquity > 0 ? totalEbitda / peakEquity : 0;

  // IRR — full 36-month series + xlsx-truncated-at-M30
  const ebitdaSeries = sorted.map((r) => Number(r.ebitdaUsd));
  const ebitdaSeriesXlsx = ebitdaSeries.slice(0, 30); // M1..M30, the xlsx window
  const irrMonthlyFull = computeMonthlyIrr(ebitdaSeries);
  const irrMonthlyXlsx = computeMonthlyIrr(ebitdaSeriesXlsx);
  const irrAnnualizedFull =
    irrMonthlyFull != null ? (irrMonthlyFull * 12).toFixed(4) : null;
  const irrAnnualizedXlsx =
    irrMonthlyXlsx != null ? (irrMonthlyXlsx * 12).toFixed(4) : null;

  return {
    rows: derived,
    totals: {
      totalCostSinIvaUsd: totalCost.toFixed(2),
      totalRevenueSinIvaUsd: totalRevenue.toFixed(2),
      totalEbitdaUsd: totalEbitda.toFixed(2),
      totalIvaOnCostsUsd: totalIva.toFixed(2),
    },
    returns: {
      revenueToCostRatio: revenueToCostRatio.toFixed(4),
      revenueToCostMarginPct: (revenueToCostRatio - 1).toFixed(4),
      ebitdaMarginPct: ebitdaMargin.toFixed(4),
      irrAnnualizedFull,
      irrAnnualizedXlsx,
      returnOnPeakEquity: returnOnPeakEquity.toFixed(4),
      peakEquityUsd: peakEquity.toFixed(2),
    },
  };
}

// ── IRR via Newton-Raphson with bisection fallback ──────────────────────────

/// Compute the monthly IRR of a cash-flow series. Returns null when no
/// root exists in [-0.99, 10.0] OR the series has no sign change.
function computeMonthlyIrr(series: number[]): number | null {
  if (series.length < 2) return null;
  const hasPositive = series.some((v) => v > 0);
  const hasNegative = series.some((v) => v < 0);
  if (!hasPositive || !hasNegative) return null;

  // NPV at rate `r` (monthly): sum cf[t] / (1 + r)^t for t = 0..n-1
  const npv = (r: number): number => {
    let acc = 0;
    for (let t = 0; t < series.length; t++) {
      acc += series[t]! / Math.pow(1 + r, t);
    }
    return acc;
  };

  // Try Newton-Raphson first from r = 0.01 (1% monthly ~ 12% annual).
  let r = 0.01;
  for (let i = 0; i < 80; i++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-7) return r;
    // Numerical derivative via central difference.
    const h = 1e-5;
    const df = (npv(r + h) - npv(r - h)) / (2 * h);
    if (df === 0) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }

  // Fallback: bisection in [-0.99, 10.0].
  let lo = -0.99;
  let hi = 10.0;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null; // no root in the bracket
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || (hi - lo) / 2 < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
