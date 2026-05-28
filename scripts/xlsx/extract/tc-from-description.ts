/**
 * Per-transaction TC extractor per Detalle egresos finding #11.
 *
 * Workbook authors encode the actual exchange rate at recording time inside
 * the Descripción text, e.g.:
 *   "FEE DE DESARROLLO MES DE ABRIL 2025 (T.C. - Q.7.71527)"
 *   "NOTA DEBITO ISR (T.C. - 7.71145)"     ← variant: no "Q."
 *   "(T.C. -  Q.7.73299)"                  ← variant: extra space
 *
 * Without this extraction, USD reconstruction is off 0.5–1% per transaction
 * because the TC varied between 7.68458 and 7.73299 across early 2025.
 *
 * The regex tolerates the format variations observed in the 20+ affected
 * transactions. Returns `null` when no match (parser falls back to project
 * TC in that case).
 *
 * Returned as Decimal-as-string per the bundle's money convention. Range
 * sanity-check (7.0 <= tc <= 8.5) rejects accidental matches on unrelated
 * decimals in the description.
 */

const TC_PATTERN = /T\.?C\.?\s*[-:=]?\s*Q?\.?\s*([0-9]+\.[0-9]+)/i;

export function extractTcFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(TC_PATTERN);
  if (!match) return null;
  const raw = match[1];
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  // Sanity check: GTQ/USD historically 7.0 - 8.5. Anything outside this is
  // a false positive (e.g., "FAC 7291" matching the regex stem) and we
  // return null so the parser falls back to project TC.
  if (!Number.isFinite(value) || value < 7.0 || value > 8.5) return null;
  return raw;
}
