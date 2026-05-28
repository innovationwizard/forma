/**
 * G&T adapter integration tests.
 *
 * Builds a synthetic xlsx in-memory matching the SHAPES observed in real
 * G&T monthlies (per `docs/REFLUJO/*.MANIFEST.md` scans), runs the adapter,
 * asserts detect + parse behavior.
 *
 * No PII — every name / amount / reference is synthetic but the STRUCTURE
 * (title row, #Cuenta row, header at row 7, trailing totals) matches.
 *
 * Real-data acceptance happens at the dev-server probe in Batch 13a.10,
 * not here. This spec is the no-PII regression net.
 */

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { gtAdapter } from "../../src/lib/import/banks/gt";
import { parseWorkbook } from "../../src/lib/import/workbook";

/// Build a workbook with one G&T-shaped sheet from a row-of-arrays array.
function buildWorkbook(sheets: Array<{ name: string; rows: unknown[][] }>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buffer;
}

/// Construct a G&T USD sheet shape mirroring January-2026 sample.
function gtUsdSheet(): unknown[][] {
  return [
    // Row 1
    ["ESTADO DE CUENTA POR RANGO DE FECHAS -  MONETARIO (DOL)"],
    [],
    // Row 3: #Cuenta | _ | account | _ | Nombre | name
    ["#Cuenta", "", "00299005975", "", "Nombre de la Cuenta", "TEST ENTITY"],
    // Row 4: Fecha Inicial | _ | start | _ | Fecha Final | end (USD shape sometimes has "Saldo Final" instead)
    ["Fecha Inicial", "", "01/01/2026", "", "Fecha Final", "31/01/2026"],
    // Row 5
    ["Saldo Inicial", "", 5167.89, "", "Generado el", "3/18/2026 1:11:49 PM"],
    [],
    // Row 7 header
    ["#", "Fecha", "Referencia", "Descripción", "Débito", "Crédito", "Saldo", "Agencia"],
    // Row 8+ data
    [1, "26/01/2026", "60715240", "NC ORDEN DE PAGO", 0, 14980, "20147.89", "AG. CENTRO 4 Av. Z. 1"],
    [2, "30/01/2026", "177", "PAGO DE CHEQUE", 8963.59, 0, "11184.3", "ROOSEVELT 2"],
    [3, "31/01/2026", "1028707", "NOTA DEBITO ISR", 0.15, 0, "11184.15", "AG. CENTRAL Z.4"],
    [4, "31/01/2026", "868746", "NC PAGO INTERÉSES", 0, 1.47, "11185.62", "AG. CENTRAL Z.4"],
    [],
    [],
    // Trailing totals
    ["No Débitos:", "", 2, "", "Total Débitos:", "8,963.74"],
    ["No. créditos:", "", 2, "", "Total créditos:", "14,981.47"],
    ["Total de Transacciones:", "", 4, "", "No. Cheques:", 1],
  ];
}

/// G&T QTZ shape — January, with the already-negative-debit sign convention.
function gtQtzSheet(): unknown[][] {
  return [
    ["ESTADO DE CUENTA POR RANGO DE FECHAS -  MONETARIO (QTZ)"],
    [],
    ["#Cuenta", "", "00200272332", "", "Nombre de la Cuenta", "TEST ENTITY"],
    ["Fecha Inicial", "", "01/01/2026", "", "Fecha Final", "31/01/2026"],
    ["Saldo Inicial", "", 494448.31, "", "Generado el", "3/18/2026 1:01:46 PM"],
    [],
    ["#", "Fecha", "Referencia", "Descripción", "Débito", "Crédito", "Saldo", "Agencia"],
    [1, "02/01/2026", "66001670", "CREDITO ACH", "", 50000, "544,448.31", "Compensacion Guate ACH"],
    [2, "15/01/2026", "53", "CHEQUE PROPIO EN CONSIGNACION", -2160, "", "542,288.31", "15 CALLE  REFORMA"],
    [3, "16/01/2026", "55", "GENERACION DARE QTZ CHPRO QTZ", -6638.21, "", "535,650.10", "15 CALLE  REFORMA"],
    [],
    ["No Débitos:", "", 2, "", "Total Débitos:", "8,798.21"],
  ];
}

describe("gtAdapter.detect()", () => {
  it("matches a G&T USD single-sheet workbook", () => {
    const buffer = buildWorkbook([{ name: "Sheet1", rows: gtUsdSheet() }]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(true);
    expect(result.bank).toBe("GT_CONTINENTAL");
    expect(result.statementType).toBe("CURRENT_ACCOUNT");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0]!.match).toBe(true);
    expect(result.sheets[0]!.detected?.accountNumber).toBe("00299005975");
    expect(result.sheets[0]!.detected?.currency).toBe("USD");
    expect(result.sheets[0]!.detected?.periodStart).toBe("2026-01-01");
    expect(result.sheets[0]!.detected?.periodEnd).toBe("2026-01-31");
    expect(result.sheets[0]!.detected?.headerRow).toBe(7);
    expect(result.sheets[0]!.detected?.isCanonical).toBe(true);
  });

  it("marks first sheet canonical + alternates non-canonical for twin-sheet G&T files", () => {
    const buffer = buildWorkbook([
      { name: "9998_orig", rows: gtUsdSheet() },
      { name: "9998_alt", rows: gtUsdSheet() },
    ]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(true);
    expect(result.sheets[0]!.detected?.isCanonical).toBe(true);
    expect(result.sheets[1]!.detected?.isCanonical).toBe(false);
  });

  it("rejects a sheet missing the title pattern", () => {
    // Pad so we clear the rowCount<7 short-circuit and reach the title check.
    const buffer = buildWorkbook([
      {
        name: "not-gt",
        rows: [
          ["Not a bank statement"],
          [],
          ["Foo", "Bar"],
          [],
          [],
          [],
          ["#", "Fecha", "Referencia", "Descripción"],
          [1, "01/01/2026", "ref", "desc"],
        ],
      },
    ]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(false);
    expect(result.sheets[0]!.match).toBe(false);
    // Per Batch 13d the adapter now falls back to CHECK_REGISTER detection
    // when CURRENT_ACCOUNT fails. For a sheet that's neither, the resulting
    // note reflects the last detector tried. We assert non-empty rather than
    // pinning the exact wording.
    expect(result.sheets[0]!.noteWhenNotMatched).toBeTruthy();
  });

  it("rejects a workbook where row 3 is missing #Cuenta", () => {
    const rows = gtUsdSheet();
    rows[2] = ["NotCuenta", "", "00299005975"];
    const buffer = buildWorkbook([{ name: "Sheet1", rows }]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.sheets[0]!.match).toBe(false);
    expect(result.sheets[0]!.noteWhenNotMatched).toBeTruthy();
  });
});

describe("gtAdapter.parse() — USD", () => {
  it("extracts 4 silver candidates from the USD sample shape", () => {
    const buffer = buildWorkbook([{ name: "Sheet1", rows: gtUsdSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });

    expect(result.silverCandidates).toHaveLength(4);

    // r8: credit 14,980 → +14,980 (CREDIT direction)
    expect(result.silverCandidates[0]).toMatchObject({
      transactionDate: "2026-01-26",
      amountSigned: "14980.00",
      direction: "CREDIT",
      reference: "60715240",
      description: "NC ORDEN DE PAGO",
      currency: "USD",
    });
    // r9: debit 8,963.59 → -8,963.59 (DEBIT direction)
    expect(result.silverCandidates[1]).toMatchObject({
      transactionDate: "2026-01-30",
      amountSigned: "-8963.59",
      direction: "DEBIT",
      reference: "177",
      description: "PAGO DE CHEQUE",
    });
  });

  it("captures EVERY source row in bronze, even trailing totals + empty rows (D31 invariant)", () => {
    const buffer = buildWorkbook([{ name: "Sheet1", rows: gtUsdSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });

    // 4 OK data rows + 2 empty rows + 3 trailing-total rows = 9 bronze rows.
    expect(result.rawRows).toHaveLength(9);
    expect(result.rawRows.filter((r) => r.parseStatus === "OK")).toHaveLength(4);
    expect(result.rawRows.filter((r) => r.parseStatus === "UNPARSEABLE")).toHaveLength(5);

    // Trailing total rows are preserved with explanatory note.
    const totalDebitos = result.rawRows.find(
      (r) => r.parseNote?.includes("Total Débitos") || r.parseNote?.includes("Trailing"),
    );
    expect(totalDebitos).toBeDefined();
  });
});

describe("gtAdapter.parse() — QTZ with already-negative-debit sign convention", () => {
  it("preserves already-negative debit values from Jan QTZ sample shape", () => {
    const buffer = buildWorkbook([{ name: "Sheet1", rows: gtQtzSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    expect(detect.sheets[0]!.detected?.currency).toBe("GTQ");

    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });
    expect(result.silverCandidates).toHaveLength(3);
    // r8: credit 50,000 → +50,000
    expect(result.silverCandidates[0]!.amountSigned).toBe("50000.00");
    expect(result.silverCandidates[0]!.direction).toBe("CREDIT");
    // r9: debit ALREADY -2,160 → -2,160 verbatim
    expect(result.silverCandidates[1]!.amountSigned).toBe("-2160.00");
    expect(result.silverCandidates[1]!.direction).toBe("DEBIT");
    // r10: debit ALREADY -6,638.21
    expect(result.silverCandidates[2]!.amountSigned).toBe("-6638.21");
  });
});
