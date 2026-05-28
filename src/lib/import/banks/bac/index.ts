/**
 * BAC adapter — STUB.
 *
 * Ships disabled. Fill in when a real BAC statement lands in `docs/REFLUJO/`.
 * See `src/lib/import/banks/gt/index.ts` for the working pattern.
 */

import type { BankAdapter, DetectResult, ParseResult } from "../../types";

export const bacAdapter: BankAdapter = {
  bank: "BAC",
  enabled: false,
  detect(): DetectResult {
    return { match: false, confidence: 0, bank: "BAC", statementType: "UNKNOWN", sheets: [] };
  },
  parse(): ParseResult {
    throw new Error("BAC adapter is a stub. Implement when real sample data lands in docs/REFLUJO/.");
  },
};
