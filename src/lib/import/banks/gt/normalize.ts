/**
 * G&T cell-normalization helpers.
 *
 * Pulled into their own module for testability — the G&T parser is the
 * security/correctness-load-bearing file of Batch 13a, and per Rule 9 we
 * want as many pure helpers as possible behind unit tests.
 */

/// Convert a G&T `Fecha` cell to ISO `YYYY-MM-DD`. Real samples have BOTH
/// shapes in the wild:
///   - `"26/01/2026"` (string, dd/mm/yyyy — most common)
///   - Excel date serial (number) when the cell type is `d` — SheetJS hands
///     us a JS Date in that case.
/// Returns null when the input doesn't parse — caller emits an UNPARSEABLE
/// raw row per D31.
export function gtFechaToIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // dd/mm/yyyy
    const m1 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (m1 != null) {
      const [, dd, mm, yyyy] = m1;
      return `${yyyy}-${mm}-${dd}`;
    }
    // ISO YYYY-MM-DD pass-through
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return null;
  }
  return null;
}

/// Normalize amount cells. G&T statements store debit/credit amounts as:
///   - Plain numbers: `8963.59`
///   - Negative numbers: `-2160`  (per January QTZ — sign varies sheet-to-sheet)
///   - Strings with commas: `"8,963.59"`
///   - The literal `0` for the "other" column when only one side has value
///   - Excel formulas that resolve to numbers (already resolved by SheetJS)
/// Returns null when the input doesn't parse to a finite number. Returns 0
/// for the literal 0 (which is a real value, not "missing").
export function gtAmountToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const stripped = trimmed.replace(/,/g, "");
    const n = Number(stripped);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/// Combine the Débito + Crédito columns into a single signed amount.
///   - If debit is present and credit is null/zero → outflow → negative.
///   - If credit is present and debit is null/zero → inflow → positive.
///   - If both are populated → adapter emits an UNPARSEABLE row.
///   - If neither → adapter emits an UNPARSEABLE row.
/// Sign convention drift: G&T sometimes stores debit values as already-
/// negative numbers. We DETECT this per-row: if the debit's raw value
/// is negative AND credit is null/zero, we treat the value as already
/// signed and return it as-is.
export function gtSignedAmount(
  debitRaw: unknown,
  creditRaw: unknown,
): { amount: number | null; reason?: string } {
  const debit = gtAmountToNumber(debitRaw);
  const credit = gtAmountToNumber(creditRaw);

  const debitPresent = debit != null && debit !== 0;
  const creditPresent = credit != null && credit !== 0;

  if (debitPresent && creditPresent) {
    return { amount: null, reason: "BOTH_DEBIT_AND_CREDIT_POPULATED" };
  }
  if (!debitPresent && !creditPresent) {
    return { amount: null, reason: "BOTH_DEBIT_AND_CREDIT_ZERO_OR_NULL" };
  }
  if (debitPresent && debit != null) {
    // Already-negative debit (Jan QTZ pattern): return verbatim.
    if (debit < 0) return { amount: debit };
    // Positive debit (most common): negate it.
    return { amount: -debit };
  }
  if (creditPresent && credit != null) {
    // Crédito column should always be positive; if it's negative, that's
    // surprising — flag it but accept verbatim.
    return { amount: credit };
  }
  return { amount: null, reason: "UNREACHABLE" };
}

/// Canonical string of an unknown cell value for hashing / equality. Used by
/// the natural-key builder when reference is missing — we hash description.
export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return "";
}
