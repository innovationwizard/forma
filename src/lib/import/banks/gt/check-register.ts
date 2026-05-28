/**
 * G&T-scoped check-register parser — Batch 13d.
 *
 * The file shape is FORMA's internal cheque-log (`0426. CORRELATIVO ...`),
 * not a G&T-generated statement. We still slot it under `banks/gt/`
 * because today's only check-register sample tracks cheques drawn on
 * G&T accounts. When other-bank registers arrive, we'd either grow this
 * to be bank-agnostic OR add a parallel `banks/<other>/check-register.ts`.
 *
 * **Signature** (observed in `0426. CORRELATIVO DE CHEQUES ANTIGUA ABRIL 26.xlsx`):
 *
 *   - Sheets named `DOLARES` + `QUETZALES` (or similar all-caps currency labels)
 *   - Row 2 col B: `"CONTROL DE CHEQUES (USD|Q) <ENTITY> <YEAR>"`
 *   - Row 3 header: `_ | ID | FECHA | NO. CHEQUE | NOMBRE | MONTO Q | MONTO $ | SOLICITUD | CONCEPTO | PARTIDA | CXC | SALDO`
 *   - Data rows from row 4
 *
 * **ANULADO rows** keep their literal text (`NOMBRE="ANULADO"`, `CONCEPTO="ANULADO"`,
 * amount=0). Per D31 these stay verbatim in bronze + are silver-promoted to
 * `IssuedCheque` with `isVoided=true`.
 *
 * **Dirty-data observed**: QUETZALES row 10 has `FECHA="XXXX"` (literal string)
 * and `MONTO Q="XXXX"`. The parser handles this without crashing: bronze
 * captures verbatim; IssuedCheque gets `issueDate=null` + `amountSigned=0` +
 * a `BANK_PARSER_WARNING` flag emitted from the issuer.
 */

import * as XLSX from "xlsx";

import type {
  DetectResult,
  IssuedChequeCandidate,
  ParseInput,
  ParseResult,
  ParserFlag,
  RawRowOutput,
  SheetDetection,
} from "../../types";
import type { ParsedSheet, ParsedWorkbook } from "../../workbook";

import { cellToString, gtAmountToNumber, gtFechaToIso } from "./normalize";

const TITLE_REGEX = /CONTROL\s+DE\s+CHEQUES\s+(USD?|Q|GTQ)\b/i;
const HEADER_SEARCH_MAX_ROW = 12;

/// Detect a G&T-context check-register workbook. Returns a complete
/// DetectResult (called by `gt/index.ts` after CURRENT_ACCOUNT detect fails).
export function detectCheckRegister(workbook: ParsedWorkbook): DetectResult {
  const sheets: SheetDetection[] = workbook.sheets.map((sheet) => detectSheet(sheet));
  const matchedCount = sheets.filter((s) => s.match).length;
  if (matchedCount === 0) {
    return {
      match: false,
      confidence: 0,
      bank: "GT_CONTINENTAL",
      statementType: "UNKNOWN",
      sheets,
    };
  }
  return {
    match: true,
    confidence: 0.9, // slightly below CURRENT_ACCOUNT (0.95) so if a future
    // file matches both signatures, CURRENT_ACCOUNT wins.
    bank: "GT_CONTINENTAL",
    statementType: "CHECK_REGISTER",
    sheets,
  };
}

function detectSheet(sheet: ParsedSheet): SheetDetection {
  if (sheet.rowCount < 4) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: `Sheet has only ${sheet.rowCount} rows; check register expects title + header + ≥1 data row.`,
    };
  }
  // Title in row 2 col B (sometimes A — be tolerant).
  const row2 = sheet.readRow(2);
  const titleA = cellToString(row2["A"]).trim();
  const titleB = cellToString(row2["B"]).trim();
  const title = titleB.length > 0 ? titleB : titleA;
  const titleMatch = TITLE_REGEX.exec(title);
  if (titleMatch == null) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: 'Row 2 col B does not match "CONTROL DE CHEQUES (USD|Q) ...".',
    };
  }
  const currencyToken = titleMatch[1]!.toUpperCase();
  const currency: "USD" | "GTQ" = currencyToken.startsWith("US") ? "USD" : "GTQ";

  const headerRow = findHeaderRow(sheet);
  if (headerRow == null) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: "Could not locate the header row (ID | FECHA | NO. CHEQUE | NOMBRE | ...).",
    };
  }

  return {
    sheetIndex: sheet.index,
    sheetName: sheet.name,
    match: true,
    detected: {
      currency,
      statementType: "CHECK_REGISTER",
      isCanonical: true, // check registers don't have twin sheets today
      headerRow,
    },
  };
}

function findHeaderRow(sheet: ParsedSheet): number | null {
  const limit = Math.min(HEADER_SEARCH_MAX_ROW, sheet.rowCount);
  for (let r = 1; r <= limit; r++) {
    const row = sheet.readRow(r);
    // Header has empty col A, "ID" in B, "FECHA" in C, "NO. CHEQUE" in D.
    const a = cellToString(row["A"]).trim();
    const b = cellToString(row["B"]).trim().toLowerCase();
    const c = cellToString(row["C"]).trim().toLowerCase();
    const d = cellToString(row["D"]).trim().toLowerCase();
    if (a === "" && b === "id" && c === "fecha" && d === "no. cheque") return r;
  }
  return null;
}

/// Called by `gt/index.ts` when `sheetDetection.detected.statementType === "CHECK_REGISTER"`.
export function parseCheckRegisterSheet(input: ParseInput): ParseResult {
  const { sheet, sheetDetection } = input;
  const detected = sheetDetection.detected;
  if (detected == null) {
    return {
      rawRows: [],
      silverCandidates: [],
      issuedChequeCandidates: [],
      flags: [
        {
          kind: "GT_PARSE_CALLED_ON_UNMATCHED_SHEET",
          severity: "WARNING",
          context: `Sheet "${sheet.name}" was passed to G&T check-register parser but detect() did not match it.`,
        },
      ],
    };
  }

  const currency = detected.currency!;
  const headerRow = detected.headerRow;

  const rawRows: RawRowOutput[] = [];
  const candidates: IssuedChequeCandidate[] = [];
  const flags: ParserFlag[] = [];

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.readRow(r);
    const rawCells = serializeRowCells(sheet, row);

    if (isEmptyRow(row)) {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: "Empty row.",
      });
      continue;
    }

    // Required: ID (col B) + NO. CHEQUE (col D). Anything missing → UNPARSEABLE.
    const id = cellToString(row["B"]).trim();
    const chequeNumberRaw = row["D"];
    const chequeNumber =
      typeof chequeNumberRaw === "number"
        ? String(chequeNumberRaw)
        : cellToString(chequeNumberRaw).trim();
    if (id === "" || chequeNumber === "") {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: "Missing ID and/or NO. CHEQUE.",
      });
      continue;
    }

    const payeeName = cellToString(row["E"]).trim();
    const concepto = cellToString(row["I"]).trim();
    const isVoided =
      payeeName.toUpperCase() === "ANULADO" || concepto.toUpperCase() === "ANULADO";

    // Amount: column F (MONTO Q) for GTQ sheet, column G (MONTO $) for USD.
    // Source can be a number, an empty cell, or — per dirty-data finding —
    // the literal string "XXXX" (QUETZALES r10). Anything non-numeric → 0
    // + a parser warning + the row still lands as IssuedCheque verbatim.
    const amountCol = currency === "USD" ? "G" : "F";
    const amountRaw = row[amountCol];
    let amountSignedNum = gtAmountToNumber(amountRaw);
    if (amountSignedNum == null) {
      if (!isVoided) {
        flags.push({
          kind: "GT_CHEQUE_AMOUNT_UNPARSEABLE",
          severity: "WARNING",
          context: `Row ${r}: NO. CHEQUE ${chequeNumber} has un-parseable amount in column ${amountCol} (got "${cellToString(amountRaw)}"). Lands as IssuedCheque with amount=0.`,
          sourceRowNumber: r,
        });
      }
      amountSignedNum = 0;
    }
    // Cheques are outflows; amount stored positive (matches MONTO column shape).
    // ANULADO rows have 0 anyway.
    if (amountSignedNum < 0) amountSignedNum = Math.abs(amountSignedNum);

    // FECHA — column C. Often null for ANULADO. Per dirty-data: literal "XXXX"
    // surfaces here too. Parser returns null + lets caller skip the DB date.
    const issueDate = gtFechaToIso(row["C"]);
    if (issueDate == null && !isVoided && cellToString(row["C"]).trim() !== "") {
      flags.push({
        kind: "GT_CHEQUE_DATE_UNPARSEABLE",
        severity: "WARNING",
        context: `Row ${r}: NO. CHEQUE ${chequeNumber} has un-parseable FECHA "${cellToString(row["C"])}". IssuedCheque.issueDate=null.`,
        sourceRowNumber: r,
      });
    }

    const solicitud = nonEmpty(cellToString(row["H"]).trim());
    const partida = nonEmpty(cellToString(row["J"]).trim());
    const cxc = nonEmpty(cellToString(row["K"]).trim());
    const saldoNum = gtAmountToNumber(row["L"]);

    rawRows.push({
      sourceRowNumber: r,
      rawCells,
      parseStatus: "OK",
    });
    candidates.push({
      bronzeRowIndex: rawRows.length - 1,
      chequeNumber,
      issueDate,
      currency,
      payeeName,
      amountSigned: amountSignedNum.toFixed(2),
      concepto,
      solicitud,
      partida,
      cxc,
      saldoAfter: saldoNum != null ? saldoNum.toFixed(2) : null,
      isVoided,
    });
  }

  return { rawRows, silverCandidates: [], issuedChequeCandidates: candidates, flags };
}

// ── Local helpers ───────────────────────────────────────────────────────────

function serializeRowCells(sheet: ParsedSheet, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let c = 0; c < sheet.columnCount; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const v = row[colLetter];
    if (v === undefined) continue;
    if (v instanceof Date) {
      out[colLetter] = v.toISOString();
    } else {
      out[colLetter] = v;
    }
  }
  return out;
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  for (const v of Object.values(row)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return false;
  }
  return true;
}

function nonEmpty(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}
