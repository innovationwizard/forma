/**
 * Anomaly badge strip per D31.
 *
 * The parser captures every contradiction and emits `DataQualityFlag` rows;
 * `anomalySnapshot()` rolls them into severity + kind counts. The L0
 * dashboard shows the rollup as small chips near the page header so the
 * CEO sees the count; each chip is a Link to the `/anomalias` listing
 * filtered by that severity so clicking opens the actionable detail.
 *
 * If there are zero flags, the strip renders a single "All clear" chip
 * (still a Link so the user can browse history).
 */

import Link from "next/link";

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
  ERROR_BLOCKING: "Bloqueante",
  ERROR_VISIBLE: "Acción requerida",
  WARNING: "Advertencias",
  INFO: "Información",
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
        <Link
          href="/anomalias?resolved=1"
          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200 ring-inset hover:bg-emerald-100"
        >
          <span aria-hidden className="mr-1">•</span>
          Todo en orden
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Banderas de calidad de datos">
      {visible.map((s) => (
        <Link
          key={s}
          href={`/anomalias?severity=${s}`}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-1",
            SEVERITY_CLASS[s],
          )}
        >
          <span aria-hidden className="mr-1">▲</span>
          {anomalies.countsBySeverity[s]} {SEVERITY_LABEL[s]}
        </Link>
      ))}
    </div>
  );
}
