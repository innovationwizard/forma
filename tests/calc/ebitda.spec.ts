import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ebitdaSnapshot } from "../../src/lib/calc/ebitda";

const month = (monthNumber: number, dateIso: string, ebitda: string, ebitdaConIva: string) => ({
  monthNumber,
  monthDate: new Date(dateIso),
  ebitda: new Prisma.Decimal(ebitda),
  ebitdaConIva: new Prisma.Decimal(ebitdaConIva),
  totalCostSinIva: new Prisma.Decimal("0"),
  ivaOnCosts: new Prisma.Decimal("0"),
  totalRevenueSinIva: new Prisma.Decimal("0"),
  creditBalance: new Prisma.Decimal("0"),
  interestPayment: new Prisma.Decimal("0"),
  principalPayment: new Prisma.Decimal("0"),
});

describe("ebitdaSnapshot", () => {
  it("sums monthly EBITDA + ebitdaConIva separately", () => {
    const r = ebitdaSnapshot(
      [
        month(1, "2025-05-01", "100", "112"),
        month(2, "2025-06-01", "200", "224"),
        month(3, "2025-07-01", "300", "336"),
      ],
      "1000",
    );
    expect(Number(r.totalEbitdaUsd)).toBeCloseTo(600, 2);
    expect(Number(r.totalEbitdaConIvaUsd)).toBeCloseTo(672, 2);
  });

  it("computes margin = totalEbitda / budgetSinIva", () => {
    const r = ebitdaSnapshot(
      [month(1, "2025-05-01", "1411019.98", "1500000")],
      "11228641.51",
    );
    expect(Number(r.marginPct)).toBeCloseTo(0.1257, 4); // matches FCFCasas2 I55 EBITDA margin
  });

  it("returns null latestMonth when no projections", () => {
    expect(ebitdaSnapshot([], "1000000").latestMonth).toBe(null);
  });

  it("picks the highest-monthNumber row as latestMonth", () => {
    const r = ebitdaSnapshot(
      [
        month(3, "2025-07-01", "300", "336"),
        month(1, "2025-05-01", "100", "112"),
        month(2, "2025-06-01", "200", "224"),
      ],
      "1000",
    );
    expect(r.latestMonth?.monthNumber).toBe(3);
    expect(r.latestMonth?.ebitdaUsd).toBe("300");
  });
});
