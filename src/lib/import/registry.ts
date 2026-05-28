/**
 * Bank-adapter registry — Batch 13a.
 *
 * Order matters only for tie-breaking when multiple adapters claim a match
 * with identical confidence. In practice each adapter's signature is
 * distinctive enough that ties don't happen.
 *
 * **Adding a new bank**: drop an adapter in `./banks/<name>/`, implement
 * `BankAdapter`, push it into BANKS. No core changes.
 */

import type { BankAdapter, DetectInput, DetectResult } from "./types";

import { gtAdapter } from "./banks/gt";
import { promericaAdapter } from "./banks/promerica";
import { bacAdapter } from "./banks/bac";
import { industrialAdapter } from "./banks/industrial";

export const BANKS: readonly BankAdapter[] = [
  gtAdapter,
  promericaAdapter,
  bacAdapter,
  industrialAdapter,
];

/**
 * Run every adapter's `detect()` against the workbook. Returns the highest-
 * confidence match, or a synthesized `UNKNOWN` result when nothing matches
 * (per D31 — every uploaded file proceeds to bronze ingestion regardless
 * of whether we recognized the bank; silver promotion just doesn't happen).
 */
export function detectBank(input: DetectInput): DetectResult {
  let best: DetectResult | null = null;
  for (const adapter of BANKS) {
    if (!adapter.enabled) continue;
    const result = adapter.detect(input);
    if (!result.match) continue;
    if (best == null || result.confidence > best.confidence) best = result;
  }
  if (best != null) return best;
  // Unknown — emit a not-matched result that still describes every sheet
  // so bronze can capture them. Each sheet gets `match: false` here.
  return {
    match: false,
    confidence: 0,
    bank: "UNKNOWN",
    statementType: "UNKNOWN",
    sheets: input.workbook.sheets.map((s) => ({
      sheetIndex: s.index,
      sheetName: s.name,
      match: false,
      detected: null,
      noteWhenNotMatched: "No registered adapter recognized this sheet's signature.",
    })),
  };
}

/// Look up an adapter by bank name. Returns null if not registered or disabled.
/// Used by the upload action to dispatch parse() after detect() picks a winner.
export function getAdapter(bank: BankAdapter["bank"]): BankAdapter | null {
  const adapter = BANKS.find((a) => a.bank === bank);
  if (adapter == null || !adapter.enabled) return null;
  return adapter;
}
