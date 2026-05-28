import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { burnRate } from "../../src/lib/calc/burn-rate";

const expAt = (date: string, usd: string) => ({
  categoryId: "c1",
  amountUsd: new Prisma.Decimal(usd),
  amountSinIva: new Prisma.Decimal("0"),
  ivaAmount: new Prisma.Decimal("0"),
  exchangeRate: new Prisma.Decimal("7.7"),
  exchangeRateAtTransaction: null,
  date: new Date(date),
});

describe("burnRate", () => {
  it("computes monthly burn = total / monthsActive", () => {
    const r = burnRate(
      [expAt("2026-01-15", "1000"), expAt("2026-02-15", "1000"), expAt("2026-03-15", "1000")],
      {
        projectStartDate: new Date("2026-01-01"),
        projectEndDate: new Date("2026-12-31"),
        now: new Date("2026-03-31"),
        totalBudgetUsd: "12000",
      },
    );
    expect(Number(r.monthlyBurnUsd)).toBeCloseTo(1000, 2);
    expect(r.monthsActive).toBe(3);
    expect(r.monthsRemaining).toBe(9);
  });

  it("trailing 3mo averages only the last 3 months", () => {
    const r = burnRate(
      [
        expAt("2026-01-15", "5000"), // outside trailing window when now=2026-06-30
        expAt("2026-04-15", "1000"),
        expAt("2026-05-15", "1000"),
        expAt("2026-06-15", "1000"),
      ],
      {
        projectStartDate: new Date("2026-01-01"),
        projectEndDate: new Date("2026-12-31"),
        now: new Date("2026-06-30"),
        totalBudgetUsd: "20000",
      },
    );
    expect(Number(r.trailing3moUsd)).toBeCloseTo(1000, 2);
  });

  it("projects total = spent + (remaining × trailing3mo)", () => {
    const r = burnRate(
      [expAt("2026-04-15", "1000"), expAt("2026-05-15", "1000"), expAt("2026-06-15", "1000")],
      {
        projectStartDate: new Date("2026-04-01"),
        projectEndDate: new Date("2026-12-31"),
        now: new Date("2026-06-30"),
        totalBudgetUsd: "12000",
      },
    );
    // spent=3000, monthsRemaining=6, trailing3mo=1000 → projected 3000 + 6000 = 9000
    expect(Number(r.projectedTotalUsd)).toBeCloseTo(9000, 2);
    expect(r.onBudgetProjection).toBe(true); // 9000 ≤ 12000 × 1.05
  });

  it("flags projection over-budget when grace exceeded", () => {
    const r = burnRate(
      [expAt("2026-04-15", "5000"), expAt("2026-05-15", "5000"), expAt("2026-06-15", "5000")],
      {
        projectStartDate: new Date("2026-04-01"),
        projectEndDate: new Date("2026-12-31"),
        now: new Date("2026-06-30"),
        totalBudgetUsd: "20000",
      },
    );
    // projected 15000 + 6×5000 = 45000 > 20000×1.05
    expect(r.onBudgetProjection).toBe(false);
  });
});
