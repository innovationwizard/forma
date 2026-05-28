/**
 * SDD §7.4 — EBITDA.
 *
 *   monthlyEbitda = totalRevenueConIva − totalCostsConIva
 *
 * The schema's `MonthlyProjection` already stores `ebitdaConIva` + `ebitda`
 * (post-IVA) per row (computed during seed from the parser bundle). This
 * module is a small aggregator — picks the totals + latest-month snapshot.
 */

import { decimalAdd, decimalDiv, decimalString } from "./currency";
import type { EbitdaSnapshot, MonthlyProjectionRow } from "./types";

export function ebitdaSnapshot(
  projections: MonthlyProjectionRow[],
  totalBudgetSinIvaUsd: string,
): EbitdaSnapshot {
  const sorted = projections.slice().sort((a, b) => a.monthNumber - b.monthNumber);
  let totalEbitda = "0";
  let totalEbitdaConIva = "0";
  for (const m of sorted) {
    totalEbitda = decimalAdd(totalEbitda, decimalString(m.ebitda));
    totalEbitdaConIva = decimalAdd(totalEbitdaConIva, decimalString(m.ebitdaConIva));
  }

  const margin =
    Number(totalBudgetSinIvaUsd) === 0
      ? "0"
      : decimalDiv(totalEbitda, totalBudgetSinIvaUsd);

  const latest = sorted.length === 0 ? null : sorted[sorted.length - 1]!;
  const latestMonth = latest
    ? {
        monthNumber: latest.monthNumber,
        monthDate: latest.monthDate.toISOString().slice(0, 10),
        ebitdaUsd: decimalString(latest.ebitda),
      }
    : null;

  return {
    totalEbitdaUsd: totalEbitda,
    totalEbitdaConIvaUsd: totalEbitdaConIva,
    marginPct: margin,
    latestMonth,
  };
}
