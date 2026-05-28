import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ivaSnapshot } from "../../src/lib/calc/iva";

const exp = (ivaGtq: string, tc: string | null = null) => ({
  ivaAmount: new Prisma.Decimal(ivaGtq),
  exchangeRate: new Prisma.Decimal("7.7"),
  exchangeRateAtTransaction: tc == null ? null : new Prisma.Decimal(tc),
});

const monthlyRev = (sinIva: string) => ({ totalRevenueSinIva: new Prisma.Decimal(sinIva) });

describe("ivaSnapshot", () => {
  it("computes IVA cobrado = revenue × rate, USD-converted", () => {
    const r = ivaSnapshot([], [monthlyRev("100000")], { lockedExchangeRate: "7.7", ivaRate: "0.12" });
    // 100,000 × 0.12 = 12,000
    expect(Number(r.ivaCobradoUsd)).toBeCloseTo(12000, 2);
  });

  it("converts IVA pagado GTQ → USD using per-tx TC if present, else locked", () => {
    const r = ivaSnapshot(
      [
        exp("770", null), // 770 / 7.7 = 100 USD (locked fallback)
        exp("771.527", "7.71527"), // 771.527 / 7.71527 = 100 USD (per-tx)
      ],
      [],
      { lockedExchangeRate: "7.7", ivaRate: "0.12" },
    );
    expect(Number(r.ivaPagadoUsd)).toBeCloseTo(200, 1);
  });

  it("net = cobrado − pagado", () => {
    const r = ivaSnapshot(
      [exp("7700", null)], // 1000 USD pagado
      [monthlyRev("100000")], // 12,000 USD cobrado
      { lockedExchangeRate: "7.7", ivaRate: "0.12" },
    );
    expect(Number(r.netIvaPayableUsd)).toBeCloseTo(11000, 1);
  });

  it("skips IVA pagado rows where TC is invalid (zero or non-finite)", () => {
    const r = ivaSnapshot(
      [
        { ...exp("770"), exchangeRate: new Prisma.Decimal("0") },
        exp("770"),
      ],
      [],
      { lockedExchangeRate: "7.7", ivaRate: "0.12" },
    );
    // first row skipped, second row 770 / 7.7 = 100
    expect(Number(r.ivaPagadoUsd)).toBeCloseTo(100, 1);
  });
});
