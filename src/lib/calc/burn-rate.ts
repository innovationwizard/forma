/**
 * SDD §7.2 — Burn rate.
 *
 *   monthlyBurn       = SUM(expenditures over months active) / monthsActive
 *   trailing3mo       = SUM(expenditures in last 3 months) / 3
 *   projectedTotal    = spent + (remainingMonths × trailing3mo)
 *   onBudgetProjection = projectedTotal ≤ budget × 1.05
 *
 * Pure function. Date math is calendar-based (month difference, not days).
 */

import type { BurnRateMetrics, ExpenditureRow } from "./types";
import { decimalAdd, decimalDiv, decimalMul, decimalString } from "./currency";

const ONE_OVER_BUDGET_GRACE = 1.05;

export interface BurnRateInput {
  /// Inclusive project start month (the calendar date of the first month).
  projectStartDate: Date;
  /// Inclusive project end month.
  projectEndDate: Date;
  /// "Now" reference for projection. Defaults to the most-recent
  /// Expenditure date in the input array (deterministic for tests).
  now?: Date;
  /// Total project budget (sin IVA) to compute the on-budget projection.
  totalBudgetUsd: string;
}

export function burnRate(
  expenditures: ExpenditureRow[],
  opts: BurnRateInput,
): BurnRateMetrics {
  const now = opts.now ?? mostRecentExpDate(expenditures) ?? new Date();
  const monthsActive = monthsBetween(opts.projectStartDate, now);
  const totalMonths = monthsBetween(opts.projectStartDate, opts.projectEndDate);
  const monthsRemaining = Math.max(0, totalMonths - monthsActive);

  const allSpent = expenditures.reduce(
    (acc, e) => decimalAdd(acc, decimalString(e.amountUsd)),
    "0",
  );

  const monthlyBurn = monthsActive > 0 ? decimalDiv(allSpent, monthsActive.toString()) : "0";

  // trailing 3 months
  const trailingStart = subtractMonths(now, 3);
  const trailingSpent = expenditures
    .filter((e) => e.date >= trailingStart && e.date <= now)
    .reduce((acc, e) => decimalAdd(acc, decimalString(e.amountUsd)), "0");
  const trailing3mo = decimalDiv(trailingSpent, "3");

  const projected = decimalAdd(
    allSpent,
    decimalMul(monthsRemaining.toString(), trailing3mo),
  );

  const budgetWithGrace = decimalMul(opts.totalBudgetUsd, ONE_OVER_BUDGET_GRACE.toString());
  const onBudgetProjection = Number(projected) <= Number(budgetWithGrace);

  return {
    monthlyBurnUsd: monthlyBurn,
    trailing3moUsd: trailing3mo,
    projectedTotalUsd: projected,
    onBudgetProjection,
    monthsActive,
    monthsRemaining,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function mostRecentExpDate(expenditures: ExpenditureRow[]): Date | null {
  if (expenditures.length === 0) return null;
  let max = expenditures[0]!.date;
  for (const e of expenditures) {
    if (e.date > max) max = e.date;
  }
  return max;
}

function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

function subtractMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() - n);
  return r;
}
