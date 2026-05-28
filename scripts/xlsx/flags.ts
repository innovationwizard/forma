/**
 * DataQualityFlag factory + collector per D31.
 *
 *   THE PARSER DOES NOT FAIL — neither loudly nor silently.
 *
 * Anomalies are first-class data. Every cell-level issue becomes a row;
 * the parser captures + flags + continues. The collector here is the
 * append-only sink the per-sheet parsers feed into.
 */

import type { DataQualityFlagKind, ParsedDataQualityFlag } from "./types";

type Severity = ParsedDataQualityFlag["severity"];

export class FlagCollector {
  private readonly flags: ParsedDataQualityFlag[] = [];

  push(args: {
    kind: DataQualityFlagKind;
    severity: Severity;
    sourceWorkbookRef: string;
    sourceValue?: string | null;
    recomputedValue?: string | null;
    humanMessage: string;
    relatedEntityType?: string | null;
    relatedEntityNaturalKey?: string | null;
  }): void {
    this.flags.push({
      kind: args.kind,
      severity: args.severity,
      sourceWorkbookRef: args.sourceWorkbookRef,
      sourceValue: args.sourceValue ?? null,
      recomputedValue: args.recomputedValue ?? null,
      humanMessage: args.humanMessage,
      relatedEntityType: args.relatedEntityType ?? null,
      relatedEntityNaturalKey: args.relatedEntityNaturalKey ?? null,
    });
  }

  snapshot(): ParsedDataQualityFlag[] {
    // Return a defensive copy. Callers should not mutate the collector's storage.
    return this.flags.slice();
  }

  /// Counts grouped by kind, for the summary report.
  byKind(): Record<DataQualityFlagKind, number> {
    const counts: Record<DataQualityFlagKind, number> = {
      MISSING_PARTIDA: 0,
      PARTIDA_FLAGGED_FOR_REVIEW: 0,
      UNIT_STATUS_CONTRADICTS_REFUND: 0,
      CATEGORY_MISLABEL: 0,
      TIMELINE_MISALIGNMENT: 0,
      CALENDAR_GAP: 0,
      STALE_FORMULA_WINDOW: 0,
      STALE_LABEL: 0,
      FLOATING_POINT_RESIDUE: 0,
      TC_AMBIGUITY: 0,
      OVERSPEND: 0,
      LARGE_NEGATIVE_REVENUE: 0,
      MIXED_CURRENCY_SUM_VALIDATED_GTQ: 0,
      MISSING_BANCO_INTENTIONAL: 0,
      UNUSED_BUDGET_FORMULA: 0,
      OUTLIER_PRICING: 0,
      CELL_COMMENT: 0,
      CROSS_SHEET_RECONCILIATION: 0,
      UNKNOWN_ANOMALY: 0,
    };
    for (const f of this.flags) counts[f.kind]++;
    return counts;
  }

  bySeverity(): Record<Severity, number> {
    const counts: Record<Severity, number> = {
      INFO: 0,
      WARNING: 0,
      ERROR_VISIBLE: 0,
      ERROR_BLOCKING: 0,
    };
    for (const f of this.flags) counts[f.severity]++;
    return counts;
  }
}
