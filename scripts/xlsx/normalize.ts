/**
 * String + value normalization helpers.
 *
 * Per [[feedback_intent_vs_implementation]]: preserve verbatim source in
 * one field, store the normalized form alongside in a parallel field.
 * Never replace; always preserve.
 *
 * Per Detalle egresos finding #3 + Ppto Inversion whitespace anomalies:
 * trailing spaces, double spaces, and non-breaking spaces (\xa0) are
 * common. Label-matching MUST normalize.
 */

/// Collapses any whitespace run (spaces, tabs, NBSP \xa0, \t, \n) into a
/// single space, then trims. Returns "" for null/undefined/empty input.
export function normalizeWhitespace(s: string | null | undefined): string {
  if (s == null) return "";
  return s.replace(/[\s ]+/g, " ").trim();
}

/// Case-insensitive equality after whitespace normalization. Used for
/// label-based parsing (D26) where the source might have trailing spaces
/// or case variations.
export function labelMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeWhitespace(a).toLowerCase() === normalizeWhitespace(b).toLowerCase();
}

/// Returns the integer position (1-based) of the first row whose column-A
/// value (after normalization) matches one of the given labels. Returns
/// `null` if no match. Used by the FCFCasas2 + Ppto Inversion parsers per
/// D26 (label-based, not position-based).
export function findRowByLabel(
  rows: Array<readonly unknown[]>,
  searchColumnIndex: number,
  candidates: readonly string[],
): number | null {
  const candidateSet = new Set(candidates.map((c) => normalizeWhitespace(c).toLowerCase()));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cell = row[searchColumnIndex];
    if (typeof cell !== "string") continue;
    if (candidateSet.has(normalizeWhitespace(cell).toLowerCase())) {
      return i + 1; // 1-based per Excel convention
    }
  }
  return null;
}

/// String coercion that handles ExcelJS's formula-cell object shape
/// (`{ formula, result, sharedFormula }`). Without this, `String(cellValue)`
/// on a formula cell yields `"[object Object]"` which corrupts partida
/// lookups. Per D31: never lose data — pull the cached result instead.
export function cellValueToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as { result?: unknown; value?: unknown; text?: unknown };
    if (obj.result != null) return cellValueToString(obj.result);
    if (obj.value != null) return cellValueToString(obj.value);
    if (obj.text != null) return cellValueToString(obj.text);
    return null; // unknown object shape; safer than "[object Object]"
  }
  return String(value);
}

/// Decimal-as-string from a possibly-numeric ExcelJS cell value. Money is
/// stored as string per _THE_RULES.MD Rule 8 (Decimal precision). Returns
/// null for null/undefined/non-numeric inputs.
export function toDecimalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/[^\d.\-eE]/g, ""));
    if (!Number.isFinite(n)) return null;
    return n.toString();
  }
  // ExcelJS may return formula results as `{ result: <number> }` or
  // rich-text objects. Extract a number where possible.
  if (typeof value === "object") {
    const obj = value as { result?: unknown; value?: unknown };
    if (obj.result != null) return toDecimalString(obj.result);
    if (obj.value != null) return toDecimalString(obj.value);
  }
  return null;
}

/// Extracts a Date from an ExcelJS cell value (JS Date, ISO string, or
/// formula-cell object `{ result | value }`). Returns ISO YYYY-MM-DD or null.
export function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear().toString().padStart(4, "0");
    const m = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = value.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return toIsoDate(parsed);
  }
  // ExcelJS formula cells: { formula, result, sharedFormula? } — recurse on result.
  if (typeof value === "object") {
    const obj = value as { result?: unknown; value?: unknown };
    if (obj.result != null) return toIsoDate(obj.result);
    if (obj.value != null) return toIsoDate(obj.value);
  }
  return null;
}

/// Generates a canonical code from a Spanish display name. Used for
/// `BudgetCategory.code` etc. when the workbook gives us a display string
/// only. Strips accents, uppercases, replaces non-alphanumeric with
/// underscore, trims leading/trailing underscores.
export function toCanonicalCode(displayName: string | null | undefined): string {
  if (!displayName) return "";
  // Decompose accented chars (é → e + combining acute) then strip combining marks.
  // Then uppercase, replace non-alphanumeric with _, collapse multiple _, trim _.
  return displayName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
