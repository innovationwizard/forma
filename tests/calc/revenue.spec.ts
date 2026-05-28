import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { revenue } from "../../src/lib/calc/revenue";

interface UnitOverrides {
  id?: string;
  name?: string;
  status?: "AVAILABLE" | "SOFT_HOLD" | "RESERVED" | "FROZEN" | "SOLD";
  salePriceSinIvaUsd?: string | null;
  saleMonth?: number | null;
  deliveryMonth?: number | null;
  engancheRate?: string;
}

let unitCounter = 0;
function unit(o: UnitOverrides = {}) {
  unitCounter += 1;
  return {
    id: o.id ?? `00000000-0000-4000-8000-${unitCounter.toString().padStart(12, "0")}`,
    name: o.name ?? "Casa X",
    status: o.status ?? ("AVAILABLE" as const),
    salePriceSinIvaUsd:
      o.salePriceSinIvaUsd === null
        ? null
        : new Prisma.Decimal(o.salePriceSinIvaUsd ?? "1000000"),
    saleMonth: o.saleMonth ?? null,
    deliveryMonth: o.deliveryMonth ?? null,
    engancheRate: new Prisma.Decimal(o.engancheRate ?? "0.25"),
  };
}

describe("revenue", () => {
  it("sums total projected across all units", () => {
    const r = revenue(
      [
        unit({ name: "Casa 1", salePriceSinIvaUsd: "1000000" }),
        unit({ name: "Casa 2", salePriceSinIvaUsd: "1100000" }),
      ],
      { projectStartDate: new Date("2025-05-01"), now: new Date("2026-01-01") },
    );
    expect(Number(r.totalProjectedSinIvaUsd)).toBeCloseTo(2100000, 2);
  });

  it("counts sold vs available", () => {
    const r = revenue(
      [
        unit({ status: "SOLD" }),
        unit({ status: "SOLD" }),
        unit({ status: "AVAILABLE" }),
        unit({ status: "RESERVED" }),
      ],
      { projectStartDate: new Date("2025-05-01"), now: new Date("2026-01-01") },
    );
    expect(r.unitCountSold).toBe(2);
    expect(r.unitCountAvailable).toBe(1);
  });

  it("realizes enganche + linear installments when saleMonth has passed", () => {
    // Project starts 2025-05; now = 2025-12; current month = 8 (May=1..Dec=8)
    // saleMonth = 2 → already passed; deliveryMonth = 14
    const r = revenue(
      [
        unit({
          status: "SOLD",
          salePriceSinIvaUsd: "1000000",
          saleMonth: 2,
          deliveryMonth: 14,
          engancheRate: "0.25",
        }),
      ],
      { projectStartDate: new Date("2025-05-01"), now: new Date("2025-12-15") },
    );
    // 6 of 12 months between sale and delivery elapsed → 50% accrued
    // enganche = 250k; installments accrued = (750k / 12) × 6 = 375k → total 625k
    expect(Number(r.realizedToDateUsd)).toBeCloseTo(625000, -2);
  });

  it("realizes full price when current month >= deliveryMonth", () => {
    const r = revenue(
      [
        unit({
          status: "SOLD",
          salePriceSinIvaUsd: "1000000",
          saleMonth: 2,
          deliveryMonth: 4,
          engancheRate: "0.25",
        }),
      ],
      { projectStartDate: new Date("2025-05-01"), now: new Date("2026-12-15") },
    );
    expect(Number(r.realizedToDateUsd)).toBeCloseTo(1000000, 2);
  });
});
