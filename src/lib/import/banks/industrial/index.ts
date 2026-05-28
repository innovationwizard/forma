/**
 * INDUSTRIAL adapter — STUB.
 *
 * Ships disabled. Fill in when a real Banco Industrial statement lands in
 * `docs/REFLUJO/`. See `src/lib/import/banks/gt/index.ts` for the working
 * pattern.
 */

import type { BankAdapter, DetectResult, ParseResult } from "../../types";

export const industrialAdapter: BankAdapter = {
  bank: "INDUSTRIAL",
  enabled: false,
  detect(): DetectResult {
    return { match: false, confidence: 0, bank: "INDUSTRIAL", statementType: "UNKNOWN", sheets: [] };
  },
  parse(): ParseResult {
    throw new Error("INDUSTRIAL adapter is a stub. Implement when real sample data lands in docs/REFLUJO/.");
  },
};
