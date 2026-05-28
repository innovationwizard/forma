/**
 * G&T cell-normalization unit tests.
 *
 * The shapes covered here are observed-real from the manifest scans on
 * 2026-05-22 (see `docs/REFLUJO/*.MANIFEST.md`). All values are synthetic
 * (no PII) — only the SHAPES are from real data.
 */

import { describe, expect, it } from "vitest";

import { gtAmountToNumber, gtFechaToIso, gtSignedAmount } from "../../src/lib/import/banks/gt/normalize";

describe("gtFechaToIso", () => {
  it("converts dd/mm/yyyy → YYYY-MM-DD (most common shape)", () => {
    expect(gtFechaToIso("26/01/2026")).toBe("2026-01-26");
    expect(gtFechaToIso("01/12/2017")).toBe("2017-12-01");
  });

  it("accepts ISO YYYY-MM-DD pass-through", () => {
    expect(gtFechaToIso("2026-04-30")).toBe("2026-04-30");
  });

  it("accepts a real JS Date (SheetJS hands these back for date-typed cells)", () => {
    const d = new Date("2026-04-30T00:00:00Z");
    expect(gtFechaToIso(d)).toBe("2026-04-30");
  });

  it("returns null for un-parseable input — caller marks the row UNPARSEABLE per D31", () => {
    expect(gtFechaToIso("")).toBeNull();
    expect(gtFechaToIso(null)).toBeNull();
    expect(gtFechaToIso(undefined)).toBeNull();
    expect(gtFechaToIso("not a date")).toBeNull();
    expect(gtFechaToIso(12345)).toBeNull();
    expect(gtFechaToIso("5/5/26")).toBeNull(); // dd/mm/yyyy is strict on 4-digit year
    expect(gtFechaToIso(new Date(Number.NaN))).toBeNull();
  });
});

describe("gtAmountToNumber", () => {
  it("passes through plain numbers", () => {
    expect(gtAmountToNumber(8963.59)).toBe(8963.59);
    expect(gtAmountToNumber(0)).toBe(0);
    expect(gtAmountToNumber(-2160)).toBe(-2160);
  });

  it("strips commas from string amounts (real G&T shape)", () => {
    expect(gtAmountToNumber("8,963.59")).toBe(8963.59);
    expect(gtAmountToNumber("1,233,551.12")).toBe(1233551.12);
  });

  it("returns null for empty / non-numeric strings (UNPARSEABLE path)", () => {
    expect(gtAmountToNumber("")).toBeNull();
    expect(gtAmountToNumber("  ")).toBeNull();
    expect(gtAmountToNumber("XXXX")).toBeNull(); // observed in check register
    expect(gtAmountToNumber(null)).toBeNull();
    expect(gtAmountToNumber(undefined)).toBeNull();
  });
});

describe("gtSignedAmount", () => {
  it("debit-only row (positive value in Débito column) → negative signed amount", () => {
    // January USD r9: PAGO DE CHEQUE 8,963.59 debit → -8,963.59 signed
    expect(gtSignedAmount(8963.59, null).amount).toBe(-8963.59);
  });

  it("credit-only row → positive signed amount", () => {
    // January USD r8: NC ORDEN DE PAGO 14,980 credit → +14,980 signed
    expect(gtSignedAmount(null, 14980).amount).toBe(14980);
  });

  it("debit column with already-negative value (Jan QTZ sign convention) → passes through", () => {
    // January QTZ r9: CHEQUE PROPIO -2,160 debit (already signed) → -2,160 verbatim
    expect(gtSignedAmount(-2160, null).amount).toBe(-2160);
    expect(gtSignedAmount(-6638.21, null).amount).toBe(-6638.21);
  });

  it("zero in the 'other' column doesn't count as populated", () => {
    // Real G&T rows: debit = 0, credit = real value
    expect(gtSignedAmount(0, 14980).amount).toBe(14980);
    expect(gtSignedAmount(8963.59, 0).amount).toBe(-8963.59);
  });

  it("emits a structured reason when un-derivable (UNPARSEABLE path)", () => {
    const { amount, reason } = gtSignedAmount(null, null);
    expect(amount).toBeNull();
    expect(reason).toBe("BOTH_DEBIT_AND_CREDIT_ZERO_OR_NULL");
  });

  it("rejects rows with BOTH debit AND credit populated", () => {
    const { amount, reason } = gtSignedAmount(100, 200);
    expect(amount).toBeNull();
    expect(reason).toBe("BOTH_DEBIT_AND_CREDIT_POPULATED");
  });
});
