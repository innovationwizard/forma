/**
 * CONCILIACIÓN parser-registry types — Batch 13a.
 *
 * The registry is the contract every bank adapter implements. Adding a new
 * bank later means dropping a new adapter file in `src/lib/import/banks/<name>/`
 * and registering it; nothing in the core has to change.
 *
 * Two layers of output per `parse()` call:
 *   - `rawRows` → goes into the BRONZE layer verbatim (one BankStatementRawRow
 *     per source data row, raw cells preserved as JSONB). Per D31 we NEVER
 *     drop a row here; if we can't normalize it, it lands with
 *     `parseStatus = UNPARSEABLE` and a `parseNote`.
 *   - `silverCandidates` → only rows that successfully normalized into a
 *     BankTransaction. Empty when the adapter couldn't interpret the row.
 *
 * `flags` is the parser's voice into `DataQualityFlag`. Anomalies the parser
 * spots (sign convention drift, balance mismatch, ambiguous header) emit
 * `INFO|WARNING|ERROR_VISIBLE` flags surfaced in the UI — never thrown.
 */

import type { BankName, Currency, StatementType, BankTransactionDirection } from "@prisma/client";

import type { ParsedWorkbook, ParsedSheet } from "./workbook";

// ── Detect ──────────────────────────────────────────────────────────────────

export interface DetectInput {
  workbook: ParsedWorkbook;
}

export interface DetectResult {
  match: boolean;
  /// 0..1 — for tie-breaking if multiple adapters match. The registry picks
  /// the highest confidence; ties resolve by registration order.
  confidence: number;
  bank: BankName;
  /// What kind of document we think this is. Drives which adapter family
  /// handles the parse: CURRENT_ACCOUNT, CHECK_REGISTER, etc.
  statementType: StatementType;
  /// Per-sheet detection results so the caller can decide which sheets to
  /// parse. A workbook can have a mix of canonical + alternate sheets.
  sheets: SheetDetection[];
}

export interface SheetDetection {
  sheetIndex: number;
  sheetName: string;
  match: boolean;
  /// When match=true, the canonical interpretation of this sheet.
  detected: {
    accountNumber?: string;
    currency?: Currency;
    periodStart?: string; // ISO YYYY-MM-DD
    periodEnd?: string;
    statementType: StatementType;
    /// True if this looks like the canonical sheet; false if it's a
    /// "(2)"-style alternate. Per Jorge directive #2 the UI ultimately
    /// owns this choice, but the adapter's first guess goes here.
    isCanonical: boolean;
    /// Header row index (1-based, matches source) where the column labels
    /// were found. Useful for debugging.
    headerRow: number;
  } | null;
  /// When match=false, why. Surfaced to the upload preview UI.
  noteWhenNotMatched?: string;
}

// ── Parse ───────────────────────────────────────────────────────────────────

export interface ParseInput {
  workbook: ParsedWorkbook;
  sheet: ParsedSheet;
  sheetDetection: SheetDetection;
}

export interface ParseResult {
  /// One per source data row. Includes rows the adapter couldn't normalize
  /// (`parseStatus = UNPARSEABLE`) — D31 invariant.
  rawRows: RawRowOutput[];
  /// CURRENT_ACCOUNT silver candidates → promote to `BankTransaction`.
  /// Subset of rawRows that produced a clean candidate. The bronze→silver
  /// linkage is by `bronzeRowIndex` (matches the position in `rawRows`).
  /// Empty when the sheet's statement type isn't CURRENT_ACCOUNT.
  silverCandidates: SilverCandidate[];
  /// CONCILIACIÓN Batch 13d: CHECK_REGISTER silver candidates → promote to
  /// `IssuedCheque`. Empty when the sheet's statement type isn't
  /// CHECK_REGISTER. A sheet can't be both — the dispatch happens in
  /// `BankAdapter.detect()`.
  issuedChequeCandidates: IssuedChequeCandidate[];
  flags: ParserFlag[];
}

export interface RawRowOutput {
  /// 1-based row number in the source spreadsheet.
  sourceRowNumber: number;
  /// Verbatim cell capture, keyed by column letter (`"A"`, `"B"`, …).
  /// Strings stay strings, numbers stay numbers, nulls stay nulls. No
  /// type coercion at this layer.
  rawCells: Record<string, unknown>;
  parseStatus: "OK" | "UNPARSEABLE";
  parseNote?: string;
}

export interface SilverCandidate {
  /// Position in the parent ParseResult.rawRows array — used to link back
  /// to the bronze row when both get inserted in the same transaction.
  bronzeRowIndex: number;
  transactionDate: string; // ISO YYYY-MM-DD
  amountSigned: string; // decimal-as-string per Rule 8 (positive=credit, negative=debit)
  currency: Currency;
  reference: string | null;
  description: string;
  agencia: string | null;
  direction: BankTransactionDirection;
  saldoAfter: string | null;
}

/// CONCILIACIÓN Batch 13d: silver candidate for `IssuedCheque`. Same provenance
/// pattern as `SilverCandidate` (bronzeRowIndex links back to the parent
/// rawRows). Money is decimal-as-string per Rule 8.
export interface IssuedChequeCandidate {
  bronzeRowIndex: number;
  chequeNumber: string;
  /// ISO YYYY-MM-DD or null when source value didn't parse (e.g. literal
  /// "XXXX" in QUETZALES r10).
  issueDate: string | null;
  currency: Currency;
  payeeName: string;
  /// Always positive (cheques are outflows). Zero for ANULADO rows.
  amountSigned: string;
  concepto: string;
  solicitud: string | null;
  partida: string | null;
  cxc: string | null;
  saldoAfter: string | null;
  isVoided: boolean;
}

export interface ParserFlag {
  kind: string; // matches DataQualityFlagKind names where possible
  severity: "INFO" | "WARNING" | "ERROR_VISIBLE";
  context: string;
  /// Row number in the source where the anomaly was detected, if applicable.
  sourceRowNumber?: number;
}

// ── Adapter contract ────────────────────────────────────────────────────────

export interface BankAdapter {
  readonly bank: BankName;
  /// True when this adapter ships a real implementation. False for the
  /// PROMERICA / BAC / INDUSTRIAL stubs — they're scaffolded but won't
  /// match anything.
  readonly enabled: boolean;
  detect(input: DetectInput): DetectResult;
  parse(input: ParseInput): ParseResult;
}
