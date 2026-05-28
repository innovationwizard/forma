/**
 * Reconciliation calc — Batch 13c tests.
 *
 * Synthetic fixtures only — no PII, no live data. Each scenario covers one
 * of the 7 status types + the cumulative-balance math.
 */

import { describe, expect, it } from "vitest";

import {
  reconcileCasa,
  type ActualPaymentInput,
  type PlannedCuotaInput,
} from "../../src/lib/calc/reconciliation";

const PROJECT_START = new Date("2025-05-06T00:00:00Z");
const NOW_MID_PROJECT = new Date("2025-08-01T00:00:00Z"); // M4 (Aug 2025)

function planned(...rows: Array<[number, string, string]>): PlannedCuotaInput[] {
  // [monthNumber, monthDate, plannedUsd]
  return rows.map(([monthNumber, monthDate, plannedUsd]) => ({
    monthNumber,
    monthDate,
    plannedUsd,
  }));
}

function payment(o: { id?: string; paymentDate: string; amountUsd: string }): ActualPaymentInput {
  return {
    id: o.id ?? `pay-${Math.random().toString(36).slice(2, 10)}`,
    paymentDate: o.paymentDate,
    amountUsd: o.amountUsd,
    bankTransactionId: null,
    reconciliationStatus: "UNMATCHED",
    notes: null,
  };
}

describe("reconcileCasa — status classification", () => {
  it("MATCHED when actual within $0.50 of planned", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [payment({ paymentDate: "2025-05-15", amountUsd: "1000.10" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("MATCHED");
    expect(r.counts.MATCHED).toBe(1);
  });

  it("OVERPAYMENT when actual > planned + tolerance", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [payment({ paymentDate: "2025-05-15", amountUsd: "1500.00" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("OVERPAYMENT");
    expect(r.rows[0]!.deltaUsd).toBe("500.00");
  });

  it("UNDERPAYMENT when actual < planned - tolerance (planned > 0)", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [payment({ paymentDate: "2025-05-15", amountUsd: "400.00" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("UNDERPAYMENT");
  });

  it("MISSED when planned > 0 AND actual = 0 AND month in the past", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT }, // M4
    );
    expect(r.rows[0]!.status).toBe("MISSED");
    expect(r.counts.MISSED).toBe(1);
  });

  it("UPCOMING when planned > 0 AND actual = 0 AND month in the future", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([12, "2026-04-06", "1000.00"]),
      [],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("UPCOMING");
  });

  it("NO_ACTIVITY when both planned and actual are zero", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([5, "2025-09-06", "0.00"]),
      [],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("NO_ACTIVITY");
    expect(r.counts.NO_ACTIVITY).toBe(1);
  });

  it("UNEXPECTED_PAYMENT when planned = 0 AND actual > 0", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "0.00"]),
      [payment({ paymentDate: "2025-05-15", amountUsd: "500.00" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.status).toBe("UNEXPECTED_PAYMENT");
  });
});

describe("reconcileCasa — cumulative math", () => {
  it("running balance tracks cumulative actual − cumulative planned across months", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned(
        [1, "2025-05-06", "1000.00"],
        [2, "2025-06-06", "1000.00"],
        [3, "2025-07-07", "1000.00"],
      ),
      [
        payment({ paymentDate: "2025-05-15", amountUsd: "1000.00" }), // M1: match
        payment({ paymentDate: "2025-06-15", amountUsd: "500.00" }),  // M2: under by 500
        payment({ paymentDate: "2025-07-15", amountUsd: "2000.00" }), // M3: over by 1000
      ],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );

    expect(r.rows[0]!.cumulativeBalanceUsd).toBe("0.00");
    expect(r.rows[1]!.cumulativeBalanceUsd).toBe("-500.00"); // behind
    expect(r.rows[2]!.cumulativeBalanceUsd).toBe("500.00"); // ahead

    expect(r.totals.plannedUsd).toBe("3000.00");
    expect(r.totals.actualUsd).toBe("3500.00");
    expect(r.totals.deltaUsd).toBe("500.00");
    expect(r.totals.completionRatio).toBe("1.1667");
  });

  it("aggregates multiple payments within the same month", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [
        payment({ paymentDate: "2025-05-10", amountUsd: "400.00" }),
        payment({ paymentDate: "2025-05-20", amountUsd: "600.00" }),
      ],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.rows[0]!.actualUsd).toBe("1000.00");
    expect(r.rows[0]!.status).toBe("MATCHED");
    expect(r.rows[0]!.payments).toHaveLength(2);
  });
});

describe("reconcileCasa — edge cases", () => {
  it("payments before project start get bucketed to M0 and appear as UNEXPECTED", () => {
    // Pre-project terreno-style: payment dated 2024-12-01 (5 months before start).
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "1000.00"]),
      [payment({ paymentDate: "2024-12-01", amountUsd: "10000.00" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    // M0 leftover should show as UNEXPECTED_PAYMENT row.
    const unexpected = r.rows.find((row) => row.status === "UNEXPECTED_PAYMENT");
    expect(unexpected).toBeDefined();
    expect(unexpected!.actualUsd).toBe("10000.00");
  });

  it("zero planned schedule across all months yields cumulative balance from leftovers", () => {
    const r = reconcileCasa(
      "Casa 1",
      planned([1, "2025-05-06", "0.00"]),
      [payment({ paymentDate: "2025-05-15", amountUsd: "10000.00" })],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT },
    );
    expect(r.totals.plannedUsd).toBe("0.00");
    expect(r.totals.actualUsd).toBe("10000.00");
    expect(r.totals.completionRatio).toBe("0.0000"); // div-by-zero guard
  });

  it("MISSED + UPCOMING boundary at currentMonth", () => {
    // Same payment date, two scenarios: month at current vs after current.
    const atCurrent = reconcileCasa(
      "Casa 1",
      planned([4, "2025-08-06", "1000.00"]),
      [],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT }, // M4
    );
    expect(atCurrent.rows[0]!.status).toBe("MISSED"); // M4 = currentMonth → past/present

    const afterCurrent = reconcileCasa(
      "Casa 1",
      planned([5, "2025-09-06", "1000.00"]),
      [],
      { projectStartDate: PROJECT_START, now: NOW_MID_PROJECT }, // M4
    );
    expect(afterCurrent.rows[0]!.status).toBe("UPCOMING"); // M5 > M4
  });
});
