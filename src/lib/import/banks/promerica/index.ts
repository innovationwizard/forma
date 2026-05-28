/**
 * PROMERICA adapter — STUB.
 *
 * Ships disabled (`enabled: false`). The detect/parse stubs exist so the
 * registry compiles; they never run because the registry skips disabled
 * adapters.
 *
 * **Fill in when a real PROMERICA statement lands in `docs/CONCILIACION/`** —
 * follow the Dirty George principle: inspect first (read the manifest +
 * eyeball the file's structure), then write detect() to match the
 * signature, then write parse() to extract rows.
 *
 * See `src/lib/import/banks/gt/index.ts` for the working pattern.
 */

import type { BankAdapter, DetectResult, ParseResult } from "../../types";

export const promericaAdapter: BankAdapter = {
  bank: "PROMERICA",
  enabled: false,
  detect(): DetectResult {
    return {
      match: false,
      confidence: 0,
      bank: "PROMERICA",
      statementType: "UNKNOWN",
      sheets: [],
    };
  },
  parse(): ParseResult {
    throw new Error("PROMERICA adapter is a stub. Implement when real sample data lands in docs/CONCILIACION/.");
  },
};
