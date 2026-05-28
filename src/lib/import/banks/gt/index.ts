/**
 * G&T Continental adapter — Batch 13a real implementation.
 *
 * Signature observed across 6 monthly statements + the consolidated workbook
 * (see `docs/CONCILIACION/*.MANIFEST.md` for the per-file scan notes):
 *
 *   - Title row 1 cell A1 matches /ESTADO DE CUENTA POR RANGO DE FECHAS .* MONETARIO \((DOL|QTZ)\)/i
 *   - Row 3 cell A3 = "#Cuenta", row 3 cell C3 = the account number
 *   - Row 7 header: # | Fecha | Referencia | Descripción | Débito | Crédito | Saldo | Agencia
 *   - Row 8 onwards: data
 *   - Trailing rows: "Total Débitos:", "Total créditos:", "Total de Transacciones:"
 *
 * Per the Dirty George principle we anchor by content, never by sheet name
 * (G&T's auto-generated names like `9998717622__3_18_2026_1_11_49_P` are
 * unpredictable) and never by absolute row index outside the header search
 * (the header is consistently at row 7, but we still look for it).
 *
 * **Twin-sheet handling**: G&T monthlies often have a `(2)`-suffixed sheet
 * that's the same data restated in different currency/sign convention. We
 * mark the first matching sheet as canonical and the rest as alternates.
 * The UI ultimately owns this per Jorge directive #2; this is just the
 * adapter's first guess.
 *
 * **Sign convention drift**: handled per-row in `gtSignedAmount` — some
 * sheets store debits as already-negative, others as positive. Both work.
 */

import * as XLSX from "xlsx";

import type {
  BankAdapter,
  DetectInput,
  DetectResult,
  ParseInput,
  ParseResult,
  ParserFlag,
  RawRowOutput,
  SheetDetection,
  SilverCandidate,
} from "../../types";
import type { ParsedSheet } from "../../workbook";

import { cellToString, gtAmountToNumber, gtFechaToIso, gtSignedAmount } from "./normalize";
import { detectCheckRegister, parseCheckRegisterSheet } from "./check-register";

const TITLE_REGEX = /ESTADO DE CUENTA POR RANGO DE FECHAS\s*-\s*MONETARIO\s*\((DOL|QTZ)\)/i;
const ACCOUNT_LABEL = "#Cuenta";
// Expected header columns per the manifest scan:
//   # | Fecha | Referencia | Descripción | Débito | Crédito | Saldo | Agencia
// We check the first 4 in rowMatchesHeader() — enough to be unambiguous.
const HEADER_SEARCH_MAX_ROW = 15; // header has always been on row 7; allow generous slack

export const gtAdapter: BankAdapter = {
  bank: "GT_CONTINENTAL",
  enabled: true,

  detect({ workbook }: DetectInput): DetectResult {
    // Try CURRENT_ACCOUNT first (higher-confidence signature). If no sheet
    // matches the current-account shape, dispatch to the check-register
    // detector. The two are mutually exclusive — no real workbook combines
    // both shapes in the same file today.
    const sheets: SheetDetection[] = workbook.sheets.map((sheet) => detectSheet(sheet));
    const matchedSheets = sheets.filter((s) => s.match);
    if (matchedSheets.length === 0) {
      // No CURRENT_ACCOUNT match — try CHECK_REGISTER.
      return detectCheckRegister(workbook);
    }
    // First matched sheet is canonical; subsequent are alternates (typical G&T
    // monthly twin-sheet pattern). Per directive #2 the UI can flip later.
    let firstCanonical = true;
    for (const s of matchedSheets) {
      if (s.detected != null) {
        s.detected.isCanonical = firstCanonical;
        firstCanonical = false;
      }
    }
    return {
      match: true,
      confidence: 0.95,
      bank: "GT_CONTINENTAL",
      statementType: "CURRENT_ACCOUNT",
      sheets,
    };
  },

  parse(input: ParseInput): ParseResult {
    const { sheet, sheetDetection } = input;
    if (sheetDetection.detected == null) {
      return {
        rawRows: [],
        silverCandidates: [],
        issuedChequeCandidates: [],
        flags: [
          {
            kind: "GT_PARSE_CALLED_ON_UNMATCHED_SHEET",
            severity: "WARNING",
            context: `Sheet "${sheet.name}" was passed to G&T parser but detect() did not match it.`,
          },
        ],
      };
    }
    // Dispatch based on detected statement type. The dispatcher gives each
    // shape its own focused parser — no `if (currentAccount) ... else if
    // (checkRegister)` branching scattered through one mega-function.
    if (sheetDetection.detected.statementType === "CHECK_REGISTER") {
      return parseCheckRegisterSheet(input);
    }
    return parseGtSheet(sheet, sheetDetection);
  },
};

// ── detect helpers ──────────────────────────────────────────────────────────

function detectSheet(sheet: ParsedSheet): SheetDetection {
  if (sheet.rowCount < 7) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: `Sheet has only ${sheet.rowCount} rows; G&T statements always have at least the row-7 header + trailing totals.`,
    };
  }

  const row1 = sheet.readRow(1);
  const titleCell = row1["A"];
  if (typeof titleCell !== "string" || !TITLE_REGEX.test(titleCell)) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: 'Row 1 cell A does not match the G&T title pattern "ESTADO DE CUENTA POR RANGO DE FECHAS - MONETARIO (DOL|QTZ)".',
    };
  }
  const titleMatch = TITLE_REGEX.exec(titleCell)!;
  const currencyToken = titleMatch[1]!.toUpperCase();
  const currency: "USD" | "GTQ" = currencyToken === "DOL" ? "USD" : "GTQ";

  // Row 3: #Cuenta | _ | <account#> | _ | Nombre de la Cuenta | <legal entity>
  const row3 = sheet.readRow(3);
  if (cellToString(row3["A"]).trim() !== ACCOUNT_LABEL) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: 'Row 3 cell A is not "#Cuenta". G&T shape mismatch.',
    };
  }
  const accountNumber = cellToString(row3["C"]).trim();

  // Find the header row (always row 7 in samples, but search defensively).
  const headerRow = findHeaderRow(sheet);
  if (headerRow == null) {
    return {
      sheetIndex: sheet.index,
      sheetName: sheet.name,
      match: false,
      detected: null,
      noteWhenNotMatched: "Could not locate the header row (# / Fecha / Referencia / ... / Agencia).",
    };
  }

  // Period: row 4 cells C + F.
  const row4 = sheet.readRow(4);
  const periodStart = gtFechaToIso(row4["C"]);
  const periodEnd = gtFechaToIso(row4["F"]); // F holds "Fecha Final" on QTZ; "Saldo Final" label on USD (only date present in QTZ shape)

  return {
    sheetIndex: sheet.index,
    sheetName: sheet.name,
    match: true,
    detected: {
      accountNumber: accountNumber.length > 0 ? accountNumber : undefined,
      currency,
      periodStart: periodStart ?? undefined,
      periodEnd: periodEnd ?? undefined,
      statementType: "CURRENT_ACCOUNT",
      isCanonical: true, // overridden by detect() after all sheets processed
      headerRow,
    },
  };
}

function findHeaderRow(sheet: ParsedSheet): number | null {
  const limit = Math.min(HEADER_SEARCH_MAX_ROW, sheet.rowCount);
  for (let r = 1; r <= limit; r++) {
    const row = sheet.readRow(r);
    if (rowMatchesHeader(row)) return r;
  }
  return null;
}

function rowMatchesHeader(row: Record<string, unknown>): boolean {
  // Check the first 4 expected columns by content. We're tolerant: any of
  // them may have leading/trailing whitespace, but the literal token must
  // match (case-insensitive for safety against future variants).
  const a = cellToString(row["A"]).trim().toLowerCase();
  const b = cellToString(row["B"]).trim().toLowerCase();
  const c = cellToString(row["C"]).trim().toLowerCase();
  const d = cellToString(row["D"]).trim().toLowerCase();
  return (
    a === "#" &&
    b === "fecha" &&
    c === "referencia" &&
    d === "descripción"
  );
}

// ── parse helpers ──────────────────────────────────────────────────────────

function parseGtSheet(sheet: ParsedSheet, detection: SheetDetection): ParseResult {
  const detected = detection.detected!;
  const headerRow = detected.headerRow;
  const currency = detected.currency!;

  const rawRows: RawRowOutput[] = [];
  const silverCandidates: SilverCandidate[] = [];
  const flags: ParserFlag[] = [];

  // Data starts the row AFTER the header; G&T leaves no blank row.
  // Stop at the first "Total Débitos:" / "Total créditos:" / "Total de Transacciones:" marker
  // OR at end of sheet.
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.readRow(r);
    const rawCells = serializeRowCells(sheet, row);

    // Detect trailing total markers — these are real rows in source so we still
    // capture them in bronze with UNPARSEABLE status (per D31: nothing dropped).
    const colA = cellToString(row["A"]).trim().toLowerCase();
    const colE = cellToString(row["E"]).trim().toLowerCase();
    if (
      colA.startsWith("no débitos") ||
      colA.startsWith("no. créditos") ||
      colA.startsWith("total de transacciones") ||
      colE.startsWith("total débitos") ||
      colE.startsWith("total créditos")
    ) {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: "Trailing summary row (Total Débitos / créditos / Transacciones).",
      });
      continue;
    }

    // Empty row in the middle of the data: capture in bronze but mark UNPARSEABLE.
    if (isEmptyRow(row)) {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: "Empty row.",
      });
      continue;
    }

    // Try to extract a real transaction.
    const isoDate = gtFechaToIso(row["B"]);
    if (isoDate == null) {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: "Could not parse Fecha cell to a date.",
      });
      flags.push({
        kind: "GT_UNPARSEABLE_DATE",
        severity: "WARNING",
        context: `Row ${r}: Fecha cell "${cellToString(row["B"])}" did not parse to a date.`,
        sourceRowNumber: r,
      });
      continue;
    }

    const { amount, reason } = gtSignedAmount(row["E"], row["F"]);
    if (amount == null) {
      rawRows.push({
        sourceRowNumber: r,
        rawCells,
        parseStatus: "UNPARSEABLE",
        parseNote: `Could not derive a signed amount: ${reason}.`,
      });
      flags.push({
        kind: "GT_SIGNED_AMOUNT_UNDERIVABLE",
        severity: "WARNING",
        context: `Row ${r}: ${reason}`,
        sourceRowNumber: r,
      });
      continue;
    }

    const reference = nonEmpty(cellToString(row["C"]));
    const description = cellToString(row["D"]).trim();
    const agencia = nonEmpty(cellToString(row["H"]).trim());
    const saldoNum = gtAmountToNumber(row["G"]);
    const direction: "DEBIT" | "CREDIT" = amount < 0 ? "DEBIT" : "CREDIT";

    rawRows.push({
      sourceRowNumber: r,
      rawCells,
      parseStatus: "OK",
    });
    silverCandidates.push({
      bronzeRowIndex: rawRows.length - 1,
      transactionDate: isoDate,
      amountSigned: amount.toFixed(2),
      currency,
      reference,
      description,
      agencia,
      direction,
      saldoAfter: saldoNum != null ? saldoNum.toFixed(2) : null,
    });
  }

  return { rawRows, silverCandidates, issuedChequeCandidates: [], flags };
}

function serializeRowCells(sheet: ParsedSheet, row: Record<string, unknown>): Record<string, unknown> {
  // Persist as JSONB-safe: convert Dates to ISO; everything else passes through.
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
