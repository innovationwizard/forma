/**
 * SDD §7.9 v0.4 — Anomaly handling per D31.
 *
 *   THE PARSER DOES NOT FAIL — neither loudly nor silently.
 *
 * Parser-emitted anomalies live as `DataQualityFlag` rows in the DB. This
 * module aggregates them into the snapshot the dashboard renders (counts
 * by severity + kind, "has actionable" boolean for badges).
 *
 * Per D31, this calc never throws on a malformed flag; it tolerates
 * unknown kinds + missing severities. The point is to SURFACE, never to
 * GATE.
 */

import type { Prisma } from "@prisma/client";

import type { AnomalySnapshot } from "./types";

type DataQualityFlagRow = Pick<
  Prisma.DataQualityFlagGetPayload<Record<string, never>>,
  "kind" | "severity" | "resolvedAt"
>;

export function anomalySnapshot(flags: DataQualityFlagRow[]): AnomalySnapshot {
  const countsBySeverity: AnomalySnapshot["countsBySeverity"] = {
    INFO: 0,
    WARNING: 0,
    ERROR_VISIBLE: 0,
    ERROR_BLOCKING: 0,
  };
  const countsByKind: Record<string, number> = {};

  for (const f of flags) {
    if (f.resolvedAt != null) continue; // resolved flags don't count toward the dashboard counts
    if (f.severity in countsBySeverity) {
      countsBySeverity[f.severity as keyof typeof countsBySeverity] += 1;
    }
    countsByKind[f.kind] = (countsByKind[f.kind] ?? 0) + 1;
  }

  const hasActionableAnomalies =
    countsBySeverity.ERROR_VISIBLE > 0 || countsBySeverity.ERROR_BLOCKING > 0;

  return { countsBySeverity, countsByKind, hasActionableAnomalies };
}
