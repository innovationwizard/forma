/**
 * DataQualityFlag listing query — backs the `/anomalias` page that opens
 * when the user clicks an AnomalyBadges chip on the dashboard.
 *
 * Read-only: per D8 + D21 the flag rows are immutable history (resolution
 * is tracked via `resolvedAt` / `resolvedByUserId` / `resolutionNote` —
 * resolving lands in a follow-up batch). For now this page lets the
 * user see WHICH flags drive the dashboard counters so the "Acción
 * requerida" chip stops being a dead-end.
 */

import type {
  DataQualityFlagKind,
  DataQualityFlagSeverity,
  PrismaClient,
} from "@prisma/client";

export interface AnomalyRow {
  id: string;
  kind: DataQualityFlagKind;
  severity: DataQualityFlagSeverity;
  sourceWorkbookRef: string;
  sourceValue: string | null;
  recomputedValue: string | null;
  humanMessage: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  raisedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface AnomaliesSnapshot {
  rows: AnomalyRow[];
  /// Total non-deleted, unresolved flag count across the filter range —
  /// useful for the page header.
  totalActive: number;
  /// Severity counts for the chip strip (mirrors AnomalySnapshot but
  /// re-derived here so this page works without the dashboard composite).
  countsBySeverity: Record<DataQualityFlagSeverity, number>;
}

export interface AnomaliesFilters {
  /// `null` = all severities.
  severity: DataQualityFlagSeverity | null;
  /// `true` = include resolved rows (history view); default false.
  includeResolved: boolean;
}

export async function loadAnomalies(
  prisma: PrismaClient,
  filters: AnomaliesFilters,
): Promise<AnomaliesSnapshot> {
  const where: Record<string, unknown> = { deletedAt: null };
  if (!filters.includeResolved) where["resolvedAt"] = null;
  if (filters.severity != null) where["severity"] = filters.severity;

  const [rows, allActive] = await Promise.all([
    prisma.dataQualityFlag.findMany({
      where,
      orderBy: [{ severity: "asc" }, { raisedAt: "desc" }],
      take: 200,
    }),
    prisma.dataQualityFlag.findMany({
      where: { deletedAt: null, resolvedAt: null },
      select: { severity: true },
    }),
  ]);

  const countsBySeverity: Record<DataQualityFlagSeverity, number> = {
    ERROR_BLOCKING: 0,
    ERROR_VISIBLE: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const f of allActive) countsBySeverity[f.severity] += 1;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      sourceWorkbookRef: r.sourceWorkbookRef,
      sourceValue: r.sourceValue,
      recomputedValue: r.recomputedValue,
      humanMessage: r.humanMessage,
      relatedEntityType: r.relatedEntityType,
      relatedEntityId: r.relatedEntityId,
      raisedAt: r.raisedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolutionNote: r.resolutionNote,
    })),
    totalActive: allActive.length,
    countsBySeverity,
  };
}
