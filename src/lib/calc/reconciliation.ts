/**
 * Per-house payment reconciliation — Batch 13c.
 *
 * Takes the planned cuota schedule (extracted from
 * `MonthlyProjection.revenuePerHouse[casaName]`) + the actual `RvPayment`
 * rows for one house, and produces a per-month reconciliation report.
 * Pure function — same shape every L0/L1/L2 calc follows.
 *
 * Replaces what Ronny does manually today in the consolidated workbook's
 * per-house sheets (`C1`, `C2`, `C5-D`, `C6`, `C7`, `C11`): each row is a
 * month, with planned cuota vs actual paid, running balance, and a status
 * pill on each row.
 *
 * Status semantics (per design doc §3 + SDD §5):
 *   NO_ACTIVITY        planned = 0 AND actual = 0     → drop from "active" rows
 *   MATCHED            |actual − planned| ≤ tolerance
 *   OVERPAYMENT        actual > planned + tolerance
 *   UNDERPAYMENT       actual < planned − tolerance AND planned > 0
 *   MISSED             planned > 0 AND actual = 0 AND month in the past
 *   UPCOMING           planned > 0 AND actual = 0 AND month in the future
 *   UNEXPECTED_PAYMENT planned = 0 AND actual > 0      (e.g. enganche overpay)
 *
 * The tolerance is $0.50 by default — covers Decimal(18,2) rounding drift
 * across many monthly accruals without making 50-cent discrepancies look
 * like real shortfalls.
 *
 * Per Rule 8: money in as `Decimal` / `string`; out as `string` (2dp).
 */

export type ReconciliationStatus =
  | "NO_ACTIVITY"
  | "MATCHED"
  | "OVERPAYMENT"
  | "UNDERPAYMENT"
  | "MISSED"
  | "UPCOMING"
  | "UNEXPECTED_PAYMENT";

export interface PlannedCuotaInput {
  monthNumber: number;
  monthDate: string; // ISO YYYY-MM-DD
  plannedUsd: string; // decimal-as-string per Rule 8
}

export interface ActualPaymentInput {
  id: string;
  paymentDate: string; // ISO YYYY-MM-DD
  amountUsd: string;
  bankTransactionId: string | null;
  reconciliationStatus: string;
  notes: string | null;
}

export interface ReconciliationMonthRow {
  monthNumber: number;
  monthDate: string;
  plannedUsd: string;
  actualUsd: string;
  deltaUsd: string;
  cumulativePlannedUsd: string;
  cumulativeActualUsd: string;
  /// cumulativeActual − cumulativePlanned. Negative = behind schedule.
  cumulativeBalanceUsd: string;
  status: ReconciliationStatus;
  payments: ActualPaymentInput[];
}

export interface ReconciliationReport {
  casaName: string;
  rows: ReconciliationMonthRow[];
  totals: {
    plannedUsd: string;
    actualUsd: string;
    deltaUsd: string;
    /// Fractional 0..∞. 1.0 = on schedule; > 1.0 = overpayment; < 1.0 = behind.
    completionRatio: string;
  };
  counts: Record<ReconciliationStatus, number>;
}

export interface ReconcileOptions {
  /// Date used to decide UPCOMING vs MISSED for zero-actual months.
  /// Defaults to `new Date()` at call time. Test fixture passes a fixed date.
  now?: Date;
  /// Project start date — drives the planned-month → calendar-month mapping
  /// used to bucket payments.
  projectStartDate: Date;
  /// Tolerance in USD for MATCHED vs OVER/UNDER classification. Default $0.50.
  toleranceUsd?: number;
}

const DEFAULT_TOLERANCE_USD = 0.5;

export function reconcileCasa(
  casaName: string,
  planned: PlannedCuotaInput[],
  payments: ActualPaymentInput[],
  opts: ReconcileOptions,
): ReconciliationReport {
  const now = opts.now ?? new Date();
  const tolerance = opts.toleranceUsd ?? DEFAULT_TOLERANCE_USD;
  const currentMonth = monthsBetween(opts.projectStartDate, now);

  // Bucket payments by month-from-start. A payment dated 2025-06-12 with a
  // project start of 2025-05-06 buckets to M2 (June).
  const paymentsByMonth = new Map<number, ActualPaymentInput[]>();
  for (const p of payments) {
    const paymentDate = new Date(`${p.paymentDate}T00:00:00Z`);
    const m = monthsBetween(opts.projectStartDate, paymentDate);
    if (!paymentsByMonth.has(m)) paymentsByMonth.set(m, []);
    paymentsByMonth.get(m)!.push(p);
  }

  // Walk the planned months. We sort by monthNumber to make sure cumulative
  // math is sensible even if the input came unordered.
  const plannedSorted = [...planned].sort((a, b) => a.monthNumber - b.monthNumber);
  const rows: ReconciliationMonthRow[] = [];
  const counts: Record<ReconciliationStatus, number> = {
    NO_ACTIVITY: 0,
    MATCHED: 0,
    OVERPAYMENT: 0,
    UNDERPAYMENT: 0,
    MISSED: 0,
    UPCOMING: 0,
    UNEXPECTED_PAYMENT: 0,
  };
  let cumPlanned = 0;
  let cumActual = 0;

  for (const p of plannedSorted) {
    const plannedNum = Number(p.plannedUsd);
    const monthPayments = paymentsByMonth.get(p.monthNumber) ?? [];
    const actualNum = monthPayments.reduce((acc, mp) => acc + Number(mp.amountUsd), 0);
    const delta = actualNum - plannedNum;
    cumPlanned += plannedNum;
    cumActual += actualNum;

    const status = classify({
      plannedNum,
      actualNum,
      delta,
      tolerance,
      monthNumber: p.monthNumber,
      currentMonth,
    });
    counts[status] += 1;

    rows.push({
      monthNumber: p.monthNumber,
      monthDate: p.monthDate,
      plannedUsd: plannedNum.toFixed(2),
      actualUsd: actualNum.toFixed(2),
      deltaUsd: delta.toFixed(2),
      cumulativePlannedUsd: cumPlanned.toFixed(2),
      cumulativeActualUsd: cumActual.toFixed(2),
      cumulativeBalanceUsd: (cumActual - cumPlanned).toFixed(2),
      status,
      payments: monthPayments,
    });

    // Drop the payments we accounted for so we can surface UNEXPECTED ones
    // (payments dated to months BEFORE the schedule starts, or after the
    // schedule ends).
    paymentsByMonth.delete(p.monthNumber);
  }

  // Any leftover payments (months without a planned cuota) get UNEXPECTED
  // rows appended. This shows up if e.g. a buyer paid in M0 (before project
  // start) or M37+ (after the schedule).
  const leftoverMonths = [...paymentsByMonth.keys()].sort((a, b) => a - b);
  for (const m of leftoverMonths) {
    const monthPayments = paymentsByMonth.get(m)!;
    const actualNum = monthPayments.reduce((acc, mp) => acc + Number(mp.amountUsd), 0);
    cumActual += actualNum;
    counts.UNEXPECTED_PAYMENT += 1;
    rows.push({
      monthNumber: m,
      monthDate: monthPayments[0]!.paymentDate, // best-effort label
      plannedUsd: "0.00",
      actualUsd: actualNum.toFixed(2),
      deltaUsd: actualNum.toFixed(2),
      cumulativePlannedUsd: cumPlanned.toFixed(2),
      cumulativeActualUsd: cumActual.toFixed(2),
      cumulativeBalanceUsd: (cumActual - cumPlanned).toFixed(2),
      status: "UNEXPECTED_PAYMENT",
      payments: monthPayments,
    });
  }
  // Re-sort so leftover UNEXPECTED rows land in month order.
  rows.sort((a, b) => a.monthNumber - b.monthNumber);

  const completionRatio = cumPlanned > 0 ? (cumActual / cumPlanned).toFixed(4) : "0.0000";

  return {
    casaName,
    rows,
    totals: {
      plannedUsd: cumPlanned.toFixed(2),
      actualUsd: cumActual.toFixed(2),
      deltaUsd: (cumActual - cumPlanned).toFixed(2),
      completionRatio,
    },
    counts,
  };
}

function classify(args: {
  plannedNum: number;
  actualNum: number;
  delta: number;
  tolerance: number;
  monthNumber: number;
  currentMonth: number;
}): ReconciliationStatus {
  const { plannedNum, actualNum, delta, tolerance, monthNumber, currentMonth } = args;
  const plannedActive = plannedNum > 0.0001;
  const actualActive = actualNum > 0.0001;

  if (!plannedActive && !actualActive) return "NO_ACTIVITY";
  if (!plannedActive && actualActive) return "UNEXPECTED_PAYMENT";
  if (plannedActive && !actualActive) {
    return monthNumber <= currentMonth ? "MISSED" : "UPCOMING";
  }
  // Both active — classify by delta.
  if (Math.abs(delta) <= tolerance) return "MATCHED";
  if (delta > 0) return "OVERPAYMENT";
  return "UNDERPAYMENT";
}

function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}
