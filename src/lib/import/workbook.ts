/**
 * SheetJS wrapper.
 *
 * Adapters operate on the abstraction here, not on SheetJS directly. Reasons:
 *   - SheetJS's `WorkBook` and `WorkSheet` APIs are verbose and cell-oriented;
 *     we want a small row-oriented API.
 *   - We never want a SheetJS dependency to leak into business logic. If we
 *     switch parsers later (e.g., a dedicated `.xls` library), only this file
 *     changes.
 *   - The shape we expose mirrors what adapters need: sheet name + index +
 *     dimensions + a row accessor that returns `Record<columnLetter, unknown>`.
 *
 * Both `.xls` (legacy OLE compound) and `.xlsx` (Office Open XML) are handled
 * natively by SheetJS — no LibreOffice subprocess, no conversion step.
 */

import * as XLSX from "xlsx";

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

export interface ParsedSheet {
  /// 0-based position in the workbook.
  index: number;
  /// Verbatim — preserves trailing spaces, weird auto-generated query IDs,
  /// etc. Adapters MUST NOT use sheet names for branching; they match by
  /// content per the Dirty George principle.
  name: string;
  /// 1-based total row count, including blank rows up to the last non-empty.
  rowCount: number;
  /// 1-based total column count, in the same sense (up to last non-empty).
  columnCount: number;
  /// Read row N (1-based, matches source spreadsheet). Returns
  /// `{ A: <value>, B: <value>, ... }` where missing cells are `undefined`
  /// (not `null`) so adapters can `if (cell != null)` cleanly.
  readRow(rowNumber: number): Record<string, unknown>;
}

/// Parse an in-memory buffer into the abstraction. Buffer comes from the
/// upload action's `File.arrayBuffer()` call — never touches the filesystem
/// in the request path.
export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true, // returns Date objects for date cells (we ISO-format later)
    cellNF: false, // we don't need number-format strings
    cellText: false, // we don't need .w pre-stringified cells
  });

  const sheets: ParsedSheet[] = workbook.SheetNames.map((name, index) => {
    const ws = workbook.Sheets[name];
    if (ws == null) {
      // Defensive — SheetNames says it exists; if not, return an empty sheet
      // rather than crashing (D31: don't fail the whole parse over one bad sheet).
      return makeEmptySheet(index, name);
    }
    return makeSheet(index, name, ws);
  });

  return { sheets };
}

function makeSheet(index: number, name: string, ws: XLSX.WorkSheet): ParsedSheet {
  const ref = ws["!ref"];
  if (ref == null) return makeEmptySheet(index, name);
  const range = XLSX.utils.decode_range(ref);
  // decode_range returns 0-based; we want 1-based for source-row consistency.
  const rowCount = range.e.r + 1;
  const columnCount = range.e.c + 1;

  return {
    index,
    name,
    rowCount,
    columnCount,
    readRow(rowNumber: number): Record<string, unknown> {
      // rowNumber is 1-based per source convention.
      const r = rowNumber - 1;
      if (r < 0 || r > range.e.r) return {};
      const out: Record<string, unknown> = {};
      for (let c = range.s.c; c <= range.e.c; c++) {
        const colLetter = XLSX.utils.encode_col(c);
        const addr = `${colLetter}${rowNumber}`;
        const cell = ws[addr] as XLSX.CellObject | undefined;
        if (cell == null) {
          out[colLetter] = undefined;
          continue;
        }
        out[colLetter] = cellValue(cell);
      }
      return out;
    },
  };
}

function makeEmptySheet(index: number, name: string): ParsedSheet {
  return {
    index,
    name,
    rowCount: 0,
    columnCount: 0,
    readRow: () => ({}),
  };
}

/// Extract a cell's value preserving native type where possible. SheetJS's
/// `CellObject` has `v` (raw value) + optional `w` (formatted display).
/// We use `v` so adapters can decide their own formatting.
function cellValue(cell: XLSX.CellObject): unknown {
  if (cell.t === "n") return typeof cell.v === "number" ? cell.v : null;
  if (cell.t === "s") return typeof cell.v === "string" ? cell.v : null;
  if (cell.t === "b") return typeof cell.v === "boolean" ? cell.v : null;
  if (cell.t === "d") return cell.v instanceof Date ? cell.v : null;
  if (cell.t === "e") return null; // Excel error cells (#REF!, #N/A, etc.) — surface as null
  if (cell.t === "z") return null; // blank
  return cell.v ?? null;
}
