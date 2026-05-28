import { describe, expect, it } from "vitest";

import { anomalySnapshot } from "../../src/lib/calc/anomaly";

const flag = (
  kind: string,
  severity: "INFO" | "WARNING" | "ERROR_VISIBLE" | "ERROR_BLOCKING",
  resolvedAt: Date | null = null,
) => ({ kind: kind as never, severity, resolvedAt });

describe("anomalySnapshot (D31)", () => {
  it("groups by severity and kind, excluding resolved flags", () => {
    const r = anomalySnapshot([
      flag("MISSING_PARTIDA", "WARNING"),
      flag("MISSING_PARTIDA", "WARNING"),
      flag("PARTIDA_FLAGGED_FOR_REVIEW", "INFO"),
      flag("UNIT_STATUS_CONTRADICTS_REFUND", "ERROR_VISIBLE"),
      flag("MISSING_PARTIDA", "WARNING", new Date("2026-04-01")), // resolved → ignored
    ]);
    expect(r.countsBySeverity.WARNING).toBe(2);
    expect(r.countsBySeverity.INFO).toBe(1);
    expect(r.countsBySeverity.ERROR_VISIBLE).toBe(1);
    expect(r.countsBySeverity.ERROR_BLOCKING).toBe(0);
    expect(r.countsByKind.MISSING_PARTIDA).toBe(2);
    expect(r.countsByKind.UNIT_STATUS_CONTRADICTS_REFUND).toBe(1);
  });

  it("flags hasActionableAnomalies when any ERROR_VISIBLE present", () => {
    const r = anomalySnapshot([flag("UNIT_STATUS_CONTRADICTS_REFUND", "ERROR_VISIBLE")]);
    expect(r.hasActionableAnomalies).toBe(true);
  });

  it("does NOT flag actionable for WARNING / INFO only (canonical dashboard signal)", () => {
    const r = anomalySnapshot([
      flag("MISSING_PARTIDA", "WARNING"),
      flag("CELL_COMMENT", "INFO"),
    ]);
    expect(r.hasActionableAnomalies).toBe(false);
  });

  it("returns zero counts when no flags", () => {
    const r = anomalySnapshot([]);
    expect(r.countsBySeverity).toEqual({
      INFO: 0,
      WARNING: 0,
      ERROR_VISIBLE: 0,
      ERROR_BLOCKING: 0,
    });
    expect(r.hasActionableAnomalies).toBe(false);
  });
});
