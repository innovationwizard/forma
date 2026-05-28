import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isrSnapshot } from "../../src/lib/calc/isr";

const month = (n: number, ebitda: string, interest = "0") => ({
  monthNumber: n,
  monthDate: new Date(`2025-${String(n).padStart(2, "0")}-01`),
  ebitda: new Prisma.Decimal(ebitda),
  ebitdaConIva: new Prisma.Decimal(ebitda),
  totalCostSinIva: new Prisma.Decimal("0"),
  ivaOnCosts: new Prisma.Decimal("0"),
  totalRevenueSinIva: new Prisma.Decimal("0"),
  creditBalance: new Prisma.Decimal("0"),
  interestPayment: new Prisma.Decimal(interest),
  principalPayment: new Prisma.Decimal("0"),
});

const obligation = (
  uiLabel: string,
  rate: string,
  rateKind: "EFFECTIVE" | "NOMINAL" | "REGIMEN_SPECIFIC",
) => ({
  uiLabel,
  rate: new Prisma.Decimal(rate),
  rateKind,
  sourceCell: "FCFCasas2!G79",
  paymentPattern: "LUMP_END" as const,
});

describe("isrSnapshot (D34 — both rates literal)", () => {
  it("preserves literal uiLabels in the output (never 'Effective' / 'Nominal')", () => {
    const r = isrSnapshot({
      obligations: [
        obligation("ISR 18", "0.18", "EFFECTIVE"),
        obligation("ISR 25", "0.25", "NOMINAL"),
      ],
      monthly: [month(1, "100000")],
    });
    expect(r.obligations.map((o) => o.uiLabel)).toEqual(["ISR 18", "ISR 25"]);
  });

  it("uses EFFECTIVE rate (0.18) for the projected total", () => {
    const r = isrSnapshot({
      obligations: [
        obligation("ISR 18", "0.18", "EFFECTIVE"),
        obligation("ISR 25", "0.25", "NOMINAL"),
      ],
      monthly: [month(1, "100000"), month(2, "100000")],
    });
    // basis = 100k + 100k = 200k → 0.18 × 200k = 36k
    expect(Number(r.projectedTotalIsrUsd)).toBeCloseTo(36000, 2);
    expect(Number(r.preTaxProfitBasisUsd)).toBeCloseTo(200000, 2);
  });

  it("subtracts interest from pre-tax basis (EBITDA − interest)", () => {
    const r = isrSnapshot({
      obligations: [obligation("ISR 18", "0.18", "EFFECTIVE")],
      monthly: [month(1, "100000", "10000")],
    });
    // basis = 100k − 10k = 90k → 0.18 × 90k = 16,200
    expect(Number(r.preTaxProfitBasisUsd)).toBeCloseTo(90000, 2);
    expect(Number(r.projectedTotalIsrUsd)).toBeCloseTo(16200, 2);
  });

  it("clamps negative basis to zero (loss → no ISR)", () => {
    const r = isrSnapshot({
      obligations: [obligation("ISR 18", "0.18", "EFFECTIVE")],
      monthly: [month(1, "-50000")],
    });
    expect(r.preTaxProfitBasisUsd).toBe("0");
    expect(r.projectedTotalIsrUsd).toBe("0");
  });

  it("falls back to first obligation when no EFFECTIVE present (never zero per D31)", () => {
    const r = isrSnapshot({
      obligations: [obligation("ISR 25", "0.25", "NOMINAL")],
      monthly: [month(1, "100000")],
    });
    expect(Number(r.projectedTotalIsrUsd)).toBeCloseTo(25000, 2);
  });
});
