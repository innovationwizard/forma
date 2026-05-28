/**
 * IVA triple-computation unit tests.
 *
 * Anchors on the project's actual rate (0.12 / Guatemala 12% VAT) and a few
 * worked numbers from the seeded data so a future rate change or rounding
 * regression surfaces here, not at the form layer.
 */

import { describe, expect, it } from "vitest";

import { computeIvaTriple } from "../../src/lib/forms/iva";

const RATE = 0.12;

describe("computeIvaTriple — Santa Elena rate 12%", () => {
  it("derives from sin-IVA", () => {
    const r = computeIvaTriple("sinIva", 1000, RATE);
    expect(r.sinIva).toBe("1000.00");
    expect(r.iva).toBe("120.00");
    expect(r.conIva).toBe("1120.00");
  });

  it("derives from con-IVA", () => {
    const r = computeIvaTriple("conIva", 1120, RATE);
    expect(r.conIva).toBe("1120.00");
    expect(r.sinIva).toBe("1000.00");
    expect(r.iva).toBe("120.00");
  });

  it("derives from iva", () => {
    const r = computeIvaTriple("iva", 120, RATE);
    expect(r.iva).toBe("120.00");
    expect(r.sinIva).toBe("1000.00");
    expect(r.conIva).toBe("1120.00");
  });

  it("matches a real Detalle egresos row (G&T USD-account FEE DE DESARROLLO)", () => {
    // Per Batch 4 inspection: $68,478.19 con IVA = $61,141.24 sin IVA + $7,336.95 IVA
    // (12% rate verified). We test the round-trip from con-IVA to make sure rounding
    // matches the source data.
    const r = computeIvaTriple("conIva", 68478.19, RATE);
    expect(r.conIva).toBe("68478.19");
    expect(r.sinIva).toBe("61141.24");
    expect(r.iva).toBe("7336.95");
  });

  it("handles zero gracefully", () => {
    const r = computeIvaTriple("sinIva", 0, RATE);
    expect(r).toEqual({ conIva: "0.00", sinIva: "0.00", iva: "0.00" });
  });

  it("handles non-finite gracefully (returns zeros, never NaN)", () => {
    expect(computeIvaTriple("sinIva", Number.NaN, RATE)).toEqual({
      conIva: "0.00",
      sinIva: "0.00",
      iva: "0.00",
    });
    expect(computeIvaTriple("conIva", Number.POSITIVE_INFINITY, RATE)).toEqual({
      conIva: "0.00",
      sinIva: "0.00",
      iva: "0.00",
    });
  });

  it("0% rate: deriving sin-IVA from iva is indeterminate; returns 0.00", () => {
    const r = computeIvaTriple("iva", 50, 0);
    expect(r.iva).toBe("50.00");
    expect(r.sinIva).toBe("0.00");
    expect(r.conIva).toBe("50.00");
  });
});
