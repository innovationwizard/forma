/**
 * G&T check-register adapter integration tests — Batch 13d.
 *
 * Synthetic xlsx fixtures matching the SHAPES of `0426. CORRELATIVO DE
 * CHEQUES ANTIGUA ABRIL 26.xlsx` (per the manifest scan 2026-05-22).
 * No PII — only structure.
 */

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { gtAdapter } from "../../src/lib/import/banks/gt";
import { parseWorkbook } from "../../src/lib/import/workbook";

function buildWorkbook(sheets: Array<{ name: string; rows: unknown[][] }>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/// DOLARES sheet — matches the real shape verbatim (per MANIFEST.md).
/// Cols (1-based, A unused): _ | ID | FECHA | NO. CHEQUE | NOMBRE | MONTO Q | MONTO $ | SOLICITUD | CONCEPTO | PARTIDA | CXC | SALDO
function dolaresSheet(): unknown[][] {
  return [
    // Row 1: empty
    [],
    // Row 2: title in col B
    [null, "CONTROL DE CHEQUES USD TEST ENTITY 2025"],
    // Row 3: header
    [null, "ID", "FECHA", "NO. CHEQUE", "NOMBRE", "MONTO Q", "MONTO $", "SOLICITUD", "CONCEPTO", "PARTIDA", "CXC", "SALDO"],
    // Row 4+: data — first 3 are ANULADO; then 2 real cheques.
    [null, 1, null, 101, "ANULADO", null, 0, null, "ANULADO", null, null, null],
    [null, 2, null, 102, "ANULADO", null, 0, null, "ANULADO", null, null, null],
    [null, 3, null, 103, "ANULADO", null, 0, null, "ANULADO", null, null, 35462.43],
    [null, 4, "2025-02-27", 105, "MANUEL AMADO RODAS", null, 323.58, null, "Visita de campo", null, null, 35138.85],
    [null, 5, "2025-02-27", 106, "TCG FINANZAS", null, 230.18, null, "Asamblea ordinaria", null, null, 34908.67],
  ];
}

/// QUETZALES sheet with the real-life dirty-data scenario in row 10:
/// FECHA="XXXX", MONTO Q="XXXX", NOMBRE="ANULADO".
function quetzalesSheet(): unknown[][] {
  return [
    [],
    [null, "CONTROL DE CHEQUES Q TEST ENTITY 2025"],
    [null, "ID", "FECHA", "NO. CHEQUE", "NOMBRE", "MONTO Q", "MONTO $", "SOLICITUD", "CONCEPTO", "PARTIDA", "CXC", "SALDO"],
    [null, 1, "2025-05-05", 1, "AGUEDO IVAN ESCOBAR", 7525, null, null, "Pago licencia ambiental", null, null, 111826.8],
    [null, 2, "2025-05-05", 2, "GLADIS MARIA ELIZONDO", 15000, null, null, "Pago final evaluación", null, null, 96826.8],
    // The dirty-data row — "XXXX" in FECHA and MONTO Q.
    [null, 7, "XXXX", 7, "ANULADO", "XXXX", null, null, "ANULADO", null, null, null],
    // A normal Q cheque with PARTIDA populated.
    [null, 8, "2025-05-06", 8, "FORMA CAPITAL", 10930.98, null, null, "REINTEGRO ISR", "ISR", null, null],
  ];
}

describe("gtAdapter.detect() — CHECK_REGISTER", () => {
  it("matches a single DOLARES sheet with the correct title pattern", () => {
    const buffer = buildWorkbook([{ name: "DOLARES", rows: dolaresSheet() }]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(true);
    expect(result.bank).toBe("GT_CONTINENTAL");
    expect(result.statementType).toBe("CHECK_REGISTER");
    expect(result.sheets[0]!.match).toBe(true);
    expect(result.sheets[0]!.detected?.currency).toBe("USD");
    expect(result.sheets[0]!.detected?.headerRow).toBe(3);
  });

  it("matches a QUETZALES sheet (Q currency token)", () => {
    const buffer = buildWorkbook([{ name: "QUETZALES", rows: quetzalesSheet() }]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(true);
    expect(result.statementType).toBe("CHECK_REGISTER");
    expect(result.sheets[0]!.detected?.currency).toBe("GTQ");
  });

  it("matches a workbook with both DOLARES + QUETZALES (the real file shape)", () => {
    const buffer = buildWorkbook([
      { name: "DOLARES", rows: dolaresSheet() },
      { name: "QUETZALES", rows: quetzalesSheet() },
    ]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(true);
    expect(result.statementType).toBe("CHECK_REGISTER");
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets.every((s) => s.match)).toBe(true);
  });

  it("rejects a sheet that's not a check register", () => {
    const buffer = buildWorkbook([
      {
        name: "random",
        rows: [
          [],
          [null, "Not a check register"],
          [null, "X", "Y", "Z"],
          [null, 1, "data", "row"],
        ],
      },
    ]);
    const workbook = parseWorkbook(buffer);
    const result = gtAdapter.detect({ workbook });
    expect(result.match).toBe(false);
  });
});

describe("gtAdapter.parse() — CHECK_REGISTER", () => {
  it("emits IssuedCheque candidates for the DOLARES shape", () => {
    const buffer = buildWorkbook([{ name: "DOLARES", rows: dolaresSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });

    // 5 data rows → 5 IssuedCheque candidates.
    expect(result.issuedChequeCandidates).toHaveLength(5);
    expect(result.silverCandidates).toHaveLength(0);

    // First 3 are ANULADO with amount 0
    expect(result.issuedChequeCandidates[0]).toMatchObject({
      chequeNumber: "101",
      payeeName: "ANULADO",
      amountSigned: "0.00",
      isVoided: true,
      currency: "USD",
    });

    // Row 4 (#105) is a real cheque
    expect(result.issuedChequeCandidates[3]).toMatchObject({
      chequeNumber: "105",
      issueDate: "2025-02-27",
      payeeName: "MANUEL AMADO RODAS",
      amountSigned: "323.58",
      currency: "USD",
      isVoided: false,
      concepto: "Visita de campo",
    });
  });

  it("captures ALL source rows in bronze even when only some are valid (D31 invariant)", () => {
    const buffer = buildWorkbook([{ name: "DOLARES", rows: dolaresSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });
    // 5 data rows. All 5 are OK (ANULADO is a valid IssuedCheque, not UNPARSEABLE).
    expect(result.rawRows).toHaveLength(5);
    expect(result.rawRows.every((r) => r.parseStatus === "OK")).toBe(true);
  });

  it("handles the QUETZALES r10 dirty-data scenario: FECHA='XXXX' + MONTO='XXXX'", () => {
    const buffer = buildWorkbook([{ name: "QUETZALES", rows: quetzalesSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });

    // 4 data rows → 4 candidates.
    expect(result.issuedChequeCandidates).toHaveLength(4);

    // The dirty row (#7 ANULADO with XXXX values) lands cleanly:
    const dirty = result.issuedChequeCandidates[2]!;
    expect(dirty.chequeNumber).toBe("7");
    expect(dirty.issueDate).toBeNull(); // FECHA="XXXX" → null
    expect(dirty.amountSigned).toBe("0.00"); // MONTO="XXXX" → 0
    expect(dirty.payeeName).toBe("ANULADO");
    expect(dirty.isVoided).toBe(true);
    // Because the row is ANULADO, no warnings emitted for its zero amount;
    // ANULADO + 0 is the expected shape.
    // Date "XXXX" on an ANULADO row also doesn't emit a warning (we don't
    // expect dates for voided cheques in the real data).
  });

  it("emits BANK_PARSER_WARNING for un-parseable amount on a non-ANULADO row", () => {
    const dirtyRows: unknown[][] = [
      [],
      [null, "CONTROL DE CHEQUES Q TEST ENTITY 2025"],
      [null, "ID", "FECHA", "NO. CHEQUE", "NOMBRE", "MONTO Q", "MONTO $", "SOLICITUD", "CONCEPTO", "PARTIDA", "CXC", "SALDO"],
      // Real cheque but amount is garbage.
      [null, 1, "2025-05-05", 99, "REAL PAYEE", "not-a-number", null, null, "real concepto", null, null, null],
    ];
    const buffer = buildWorkbook([{ name: "QUETZALES", rows: dirtyRows }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });
    expect(result.issuedChequeCandidates).toHaveLength(1);
    expect(result.issuedChequeCandidates[0]!.amountSigned).toBe("0.00");
    expect(result.flags.some((f) => f.kind === "GT_CHEQUE_AMOUNT_UNPARSEABLE")).toBe(true);
  });

  it("captures PARTIDA when populated (real shape includes optional ISR / categorization)", () => {
    const buffer = buildWorkbook([{ name: "QUETZALES", rows: quetzalesSheet() }]);
    const workbook = parseWorkbook(buffer);
    const detect = gtAdapter.detect({ workbook });
    const result = gtAdapter.parse({
      workbook,
      sheet: workbook.sheets[0]!,
      sheetDetection: detect.sheets[0]!,
    });
    // Row 8 has PARTIDA="ISR"
    const partidaRow = result.issuedChequeCandidates.find((c) => c.chequeNumber === "8");
    expect(partidaRow).toBeDefined();
    expect(partidaRow!.partida).toBe("ISR");
  });
});
