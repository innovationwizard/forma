import { describe, expect, it } from "vitest";

import {
  currencyVarianceTotals,
  reconstructUsd,
  transactionVarianceUsd,
} from "../../src/lib/calc/currency";

describe("reconstructUsd", () => {
  it("uses per-transaction TC when present", () => {
    expect(
      reconstructUsd({
        amountGtq: "7700",
        exchangeRateAtTransaction: "7.7",
        lockedExchangeRate: "7.7",
      }),
    ).toBe("1000.00");
  });

  it("falls back to project-locked TC when per-tx TC is null (Detalle egresos finding #11)", () => {
    expect(
      reconstructUsd({
        amountGtq: "7700",
        exchangeRateAtTransaction: null,
        lockedExchangeRate: "7.7",
      }),
    ).toBe("1000.00");
  });

  it("per-tx TC override yields a different USD amount than locked", () => {
    // Q61141 at 7.71527 (real Apr-2025 fee transaction) ≈ $7924.07
    // Locked at 7.7 would be $7940.39 — ~$16 off per transaction
    const withRealTc = reconstructUsd({
      amountGtq: "61141.24",
      exchangeRateAtTransaction: "7.71527",
      lockedExchangeRate: "7.7",
    });
    const withLocked = reconstructUsd({
      amountGtq: "61141.24",
      exchangeRateAtTransaction: null,
      lockedExchangeRate: "7.7",
    });
    expect(withRealTc).not.toBe(withLocked);
    expect(Math.abs(Number(withRealTc) - Number(withLocked))).toBeGreaterThan(10);
  });
});

describe("transactionVarianceUsd", () => {
  it("zero variance when actual = locked", () => {
    expect(
      transactionVarianceUsd({ amountGtq: "7700", actualTc: "7.7", lockedTc: "7.7" }),
    ).toBe("0.00");
  });

  it("positive variance when actual > locked", () => {
    const v = transactionVarianceUsd({
      amountGtq: "7700",
      actualTc: "7.71527",
      lockedTc: "7.7",
    });
    expect(Number(v)).toBeGreaterThan(0);
  });
});

describe("currencyVarianceTotals", () => {
  it("ignores transactions without per-tx TC and aggregates the rest", () => {
    const r = currencyVarianceTotals(
      [
        // Without per-tx TC → ignored
        {
          categoryId: "c1",
          amountUsd: { toString: () => "100" } as never,
          amountSinIva: { toString: () => "770" } as never,
          ivaAmount: { toString: () => "0" } as never,
          exchangeRate: { toString: () => "7.7" } as never,
          exchangeRateAtTransaction: null,
          date: new Date("2026-04-01"),
          sourceWorkbookRef: "Detalle egresos!row 1",
          vendorRaw: "Vendor A",
        },
        // With per-tx TC → counted
        {
          categoryId: "c1",
          amountUsd: { toString: () => "100" } as never,
          amountSinIva: { toString: () => "770" } as never,
          ivaAmount: { toString: () => "0" } as never,
          exchangeRate: { toString: () => "7.7" } as never,
          exchangeRateAtTransaction: { toString: () => "7.715" } as never,
          date: new Date("2026-04-01"),
          sourceWorkbookRef: "Detalle egresos!row 2",
          vendorRaw: "Vendor B",
        },
      ],
      "7.7",
    );
    expect(r.topContributors).toHaveLength(1);
    expect(r.topContributors[0]!.sourceWorkbookRef).toBe("Detalle egresos!row 2");
    expect(Number(r.totalVarianceUsd)).not.toBe(0);
  });
});
