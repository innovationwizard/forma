/**
 * Projection-runner tests — Batch 16a.
 *
 * Verifies the pure function over synthetic series:
 *   - Cumulative math (cost, revenue, EBITDA, low-water mark)
 *   - The 4 D28 returns
 *   - IRR over both full + xlsx-truncated windows
 *   - Q-TIRI-WINDOW behavior (a discrepancy surfaces when the truncation
 *     window genuinely produces a different IRR)
 */

import { describe, expect, it } from "vitest";

import {
  runProjection,
  type ProjectionInputRow,
} from "../../src/lib/calc/projection-runner";

function row(o: Partial<ProjectionInputRow> & { monthNumber: number }): ProjectionInputRow {
  return {
    monthDate: `2025-${String(((o.monthNumber - 1) % 12) + 1).padStart(2, "0")}-01`,
    costSinIvaUsd: "0",
    ivaOnCostsUsd: "0",
    costConIvaUsd: "0",
    revenueSinIvaUsd: "0",
    ebitdaUsd: "0",
    ebitdaConIvaUsd: "0",
    creditBalanceUsd: "0",
    interestPaymentUsd: "0",
    principalPaymentUsd: "0",
    ...o,
  };
}

describe("runProjection — cumulative math", () => {
  it("accumulates cost / revenue / EBITDA across months", () => {
    const r = runProjection([
      row({ monthNumber: 1, costSinIvaUsd: "100", revenueSinIvaUsd: "0", ebitdaUsd: "-100" }),
      row({ monthNumber: 2, costSinIvaUsd: "200", revenueSinIvaUsd: "0", ebitdaUsd: "-200" }),
      row({ monthNumber: 3, costSinIvaUsd: "0", revenueSinIvaUsd: "500", ebitdaUsd: "500" }),
    ]);
    expect(r.totals.totalCostSinIvaUsd).toBe("300.00");
    expect(r.totals.totalRevenueSinIvaUsd).toBe("500.00");
    expect(r.totals.totalEbitdaUsd).toBe("200.00");
    expect(r.rows[0]!.cumulativeEbitdaUsd).toBe("-100.00");
    expect(r.rows[1]!.cumulativeEbitdaUsd).toBe("-300.00");
    expect(r.rows[2]!.cumulativeEbitdaUsd).toBe("200.00");
  });

  it("tracks peak equity as |min(cum EBITDA)| (low-water mark)", () => {
    const r = runProjection([
      row({ monthNumber: 1, ebitdaUsd: "-100" }),
      row({ monthNumber: 2, ebitdaUsd: "-500" }),
      row({ monthNumber: 3, ebitdaUsd: "200" }),
      row({ monthNumber: 4, ebitdaUsd: "1000" }),
    ]);
    expect(r.rows[1]!.cumulativeEbitdaLowwaterUsd).toBe("-600.00");
    expect(r.returns.peakEquityUsd).toBe("600.00");
  });
});

describe("runProjection — D28 returns", () => {
  it("revenueToCostRatio + margin", () => {
    const r = runProjection([
      row({ monthNumber: 1, costSinIvaUsd: "1000", revenueSinIvaUsd: "1130", ebitdaUsd: "130" }),
    ]);
    expect(Number(r.returns.revenueToCostRatio)).toBeCloseTo(1.13, 4);
    expect(Number(r.returns.revenueToCostMarginPct)).toBeCloseTo(0.13, 4);
  });

  it("ebitdaMarginPct = totalEbitda / totalCost", () => {
    const r = runProjection([
      row({ monthNumber: 1, costSinIvaUsd: "100", ebitdaUsd: "12.6" }),
    ]);
    expect(Number(r.returns.ebitdaMarginPct)).toBeCloseTo(0.126, 4);
  });

  it("returnOnPeakEquity = totalEbitda / peak equity", () => {
    const r = runProjection([
      row({ monthNumber: 1, ebitdaUsd: "-100" }),
      row({ monthNumber: 2, ebitdaUsd: "175.6" }),
    ]);
    // total = 75.6, peak equity = 100, return = 0.756
    expect(Number(r.returns.returnOnPeakEquity)).toBeCloseTo(0.756, 3);
  });
});

describe("runProjection — IRR", () => {
  it("computes a positive annualized IRR for an upward-bending series", () => {
    // 11 months of -1000 + 1 month of +13200 → ~3% monthly IRR, ~36% annualized
    const rows: ProjectionInputRow[] = [];
    for (let i = 1; i <= 11; i++) rows.push(row({ monthNumber: i, ebitdaUsd: "-1000" }));
    rows.push(row({ monthNumber: 12, ebitdaUsd: "13200" }));
    const r = runProjection(rows);
    expect(r.returns.irrAnnualizedFull).not.toBeNull();
    const irr = Number(r.returns.irrAnnualizedFull);
    expect(irr).toBeGreaterThan(0.2);
    expect(irr).toBeLessThan(0.5);
  });

  it("returns null for a series with no sign change", () => {
    const rows: ProjectionInputRow[] = [];
    for (let i = 1; i <= 5; i++) rows.push(row({ monthNumber: i, ebitdaUsd: "-100" }));
    const r = runProjection(rows);
    expect(r.returns.irrAnnualizedFull).toBeNull();
  });

  it("Q-TIRI-WINDOW: 30-month truncation yields different IRR than full 36-month", () => {
    // Front-load losses, back-load gains. Truncation drops the final
    // recovery → 30-month IRR is materially lower than 36-month.
    const rows: ProjectionInputRow[] = [];
    for (let i = 1; i <= 30; i++) rows.push(row({ monthNumber: i, ebitdaUsd: "-100" }));
    for (let i = 31; i <= 36; i++) rows.push(row({ monthNumber: i, ebitdaUsd: "1000" }));
    const r = runProjection(rows);
    // Full 36 has a positive return; 30-month truncation has no positive
    // EBITDA → returns null (no sign change in window).
    expect(r.returns.irrAnnualizedXlsx).toBeNull();
    expect(r.returns.irrAnnualizedFull).not.toBeNull();
  });
});
