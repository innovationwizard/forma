/**
 * Anomaly badge strip per D31.
 *
 * The parser captures every contradiction and emits `DataQualityFlag` rows;
 * `anomalySnapshot()` rolls them into severity + kind counts. The L0
 * dashboard shows the rollup as small chips near the page header so the
 * CEO sees the count, but the L0 view itself does not let the canonical
 * order shift in response to anomalies (D25). Detail views are where each
 * flag becomes resolvable.
 *
 * If there are zero flags, the strip renders a single "All clear" chip.
 */

import type { AnomalySnapshot } from "@/lib/calc/types";
import { cn } from "@/lib/utils";

interface AnomalyBadgesProps {
  anomalies: AnomalySnapshot;
}

type SeverityKey = keyof AnomalySnapshot["countsBySeverity"];

const SEVERITY_ORDER: SeverityKey[] = [
  "ERROR_BLOCKING",
  "ERROR_VISIBLE",
  "WARNING",
  "INFO",
];

const SEVERITY_LABEL: Record<SeverityKey, string> = {
  ERROR_BLOCKING: "Blocking",
  ERROR_VISIBLE: "Action needed",
  WARNING: "Warnings",
  INFO: "Info",
};

const SEVERITY_CLASS: Record<SeverityKey, string> = {
  ERROR_BLOCKING: "bg-red-100 text-red-900 ring-red-300",
  ERROR_VISIBLE: "bg-red-50 text-red-900 ring-red-200",
  WARNING: "bg-amber-50 text-amber-900 ring-amber-200",
  INFO: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function AnomalyBadges({ anomalies }: AnomalyBadgesProps) {
  const visible = SEVERITY_ORDER.filter((s) => (anomalies.countsBySeverity[s] ?? 0) > 0);

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200 ring-inset">
          <span aria-hidden className="mr-1">•</span>
          All checks clear
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Data quality flags">
      {visible.map((s) => (
        <span
          key={s}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
            SEVERITY_CLASS[s],
          )}
        >
          <span aria-hidden className="mr-1">▲</span>
          {anomalies.countsBySeverity[s]} {SEVERITY_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
