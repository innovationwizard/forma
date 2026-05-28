/**
 * Unit tests for src/lib/calc/budget-health.ts (SDD §7.1).
 *
 * Test fixtures are synthetic per Rule 9 (isolated under `tests/`, labeled,
 * never imported by production code). End-to-end parity vs the real
 * seeded DB lives in `scripts/verify-calc.ts`.
 */

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { budgetHealthAll, categoryHealth } from "../../src/lib/calc/budget-health";

const cat = (id: string, code: string, budget: string) => ({
  id,
  code,
  name: code,
  budgetAmountUsd: new Prisma.Decimal(budget),
  dashboardVisible: true,
  sortOrder: 1,
});

const exp = (categoryId: string, usd: string) => ({
  categoryId,
  amountUsd: new Prisma.Decimal(usd),
  amountSinIva: new Prisma.Decimal("0"),
  ivaAmount: new Prisma.Decimal("0"),
  exchangeRate: new Prisma.Decimal("7.7"),
  exchangeRateAtTransaction: null,
  date: new Date("2026-04-01"),
});

describe("categoryHealth", () => {
  it("ON_TRACK: spend below 80%", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "1000"), [exp("c1", "500")], {
      projectMonth: 6,
    });
    expect(r.status).toBe("ON_TRACK");
    expect(r.spentUsd).toBe("500");
    expect(r.remainingUsd).toBe("500");
    expect(r.pctConsumed).toBe("0.5");
  });

  it("AT_RISK: 80% < pct ≤ 100%", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "1000"), [exp("c1", "850")], {
      projectMonth: 6,
    });
    expect(r.status).toBe("AT_RISK");
  });

  it("OVER_BUDGET: pct > 100% (TERRENOS-style overspend per inspection finding #1)", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "9106000"), [exp("c1", "10632286")], {
      projectMonth: 6,
    });
    expect(r.status).toBe("OVER_BUDGET");
    expect(Number(r.pctConsumed)).toBeGreaterThan(1.0);
  });

  it("NOT_STARTED: zero spend, project month ≤ expectedStart", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "1000"), [], { projectMonth: 3 });
    expect(r.status).toBe("NOT_STARTED");
    expect(r.spentUsd).toBe("0");
  });

  it("DELAYED: zero spend, project month > expectedStart", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "1000"), [], { projectMonth: 12 });
    expect(r.status).toBe("DELAYED");
  });

  it("matches expenditures only by categoryId (cross-category isolation)", () => {
    const r = categoryHealth(cat("c1", "TERRENOS", "1000"), [exp("c2", "9999"), exp("c1", "100")], {
      projectMonth: 6,
    });
    expect(r.spentUsd).toBe("100");
  });

  it("handles zero-budget categories (Q-IMPUESTOS-NO-BUDGET per Ppto Inversion finding) — pct = Infinity, OVER_BUDGET if any spend", () => {
    const r = categoryHealth(cat("c1", "IMPUESTOS", "0"), [exp("c1", "94254.95")], {
      projectMonth: 6,
    });
    // Per the manifest: budget=0 + actual>0 → 100% overspend per Q-IMPUESTOS-NO-BUDGET.
    expect(r.status).toBe("OVER_BUDGET");
    expect(r.pctConsumed).toBe("Infinity");
  });
});

describe("budgetHealthAll", () => {
  it("returns one health row per category, preserving sortOrder", () => {
    const cats = [
      { ...cat("c1", "TERRENOS", "1000"), sortOrder: 1 },
      { ...cat("c2", "MERCADEO", "500"), sortOrder: 6 },
    ];
    const r = budgetHealthAll(cats, [exp("c1", "300"), exp("c2", "400")], { projectMonth: 6 });
    expect(r).toHaveLength(2);
    expect(r[0]!.code).toBe("TERRENOS");
    expect(r[1]!.code).toBe("MERCADEO");
    expect(r[0]!.sortOrder).toBe(1);
    expect(r[1]!.sortOrder).toBe(6);
  });
});

// ── Batch 7.5: PartnerContribution rollup into budget-health ───────────────
describe("categoryHealth — Batch 7.5 PartnerContribution rollup", () => {
  const pc = (categoryId: string | null, amountUsd: string) => ({
    categoryId,
    amountUsd: new Prisma.Decimal(amountUsd),
  });

  it("includes PartnerContribution amounts in spent total (matches Santa Elena TERRENO overspend pattern)", () => {
    // Mirrors the SE setup: TERRENOS budget $1,182,597.40 + 2 PCs totaling $1,381,048
    // → spent > budget → OVER_BUDGET (matches Q-TERRENO-OVERSPEND / OVERSPEND flag).
    const r = categoryHealth(
      cat("terrenos", "TERRENOS", "1182597.40"),
      [], // no Expenditure rows for TERRENO category in SE current snapshot
      { projectMonth: 13 },
      [
        pc("terrenos", "1181400"), // ≈ $9,096,780 / 7.7 in-kind 2018
        pc("terrenos", "199416"), // ≈ $1,535,506 / 7.7 cash 2025
      ],
    );
    expect(r.status).toBe("OVER_BUDGET");
    expect(Number(r.spentUsd)).toBeGreaterThan(Number(r.budgetUsd));
  });

  it("ignores PartnerContributions for non-matching categories", () => {
    const r = categoryHealth(
      cat("mercadeo", "MERCADEO", "200000"),
      [exp("mercadeo", "50000")],
      { projectMonth: 6 },
      [
        pc("terrenos", "1000000"), // wrong category — should NOT bleed into MERCADEO
        pc(null, "999999"), // null category — should NOT bleed anywhere
      ],
    );
    expect(r.spentUsd).toBe("50000");
    expect(r.status).toBe("ON_TRACK");
  });

  it("backward-compatible: passing no partnerContributions arg works", () => {
    const r = categoryHealth(
      cat("c1", "TERRENOS", "1000"),
      [exp("c1", "500")],
      { projectMonth: 6 },
      // no fourth arg
    );
    expect(r.spentUsd).toBe("500");
  });
});
