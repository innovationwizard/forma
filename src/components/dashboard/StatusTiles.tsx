/**
 * 4-tile status counter row: On Track / At Risk / Over Budget / Not Started.
 *
 * Counts only DASHBOARD-visible categories per D25 (the canonical 11). The
 * "Over" tile is highlighted when count > 0 — the CEO's eye is drawn to
 * a non-zero red tile regardless of where it sits in the row, satisfying
 * D25's "anomaly visibility via visual treatment" without reordering.
 *
 * Accessibility: each tile is a labelled region with the count and label
 * both readable; status icons supplement color (not replace it).
 */

import type { CategoryHealth, BudgetHealthStatus } from "@/lib/calc/types";
import { cn } from "@/lib/utils";

import { statusStyle } from "./status-style";

interface StatusTilesProps {
  categories: CategoryHealth[];
}

const TILE_ORDER: BudgetHealthStatus[] = [
  "ON_TRACK",
  "AT_RISK",
  "OVER_BUDGET",
  "NOT_STARTED",
];

export function StatusTiles({ categories }: StatusTilesProps) {
  // Count only dashboard-visible categories per D25 — system fallbacks
  // (IMPUESTOS, CASH_MOVEMENTS) are intentionally excluded from L0.
  const visible = categories.filter((c) => c.dashboardVisible);
  const counts = countByStatus(visible);

  return (
    <section
      aria-label="Conteo de categorías por estado"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {TILE_ORDER.map((status) => {
        const style = statusStyle(status);
        const count = counts[status] ?? 0;
        const hasItems = count > 0;
        return (
          <div
            key={status}
            className={cn(
              "border-foreground/10 bg-card flex flex-col gap-1 rounded-xl border p-4 shadow-sm",
              hasItems && style.rowClass,
            )}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("text-base", hasItems ? style.textClass : "text-zinc-400")}
              >
                {style.icon}
              </span>
              <span className="text-foreground/70 text-xs font-medium tracking-wide uppercase">
                {style.label}
              </span>
            </div>
            <span className="text-foreground text-3xl font-semibold tabular-nums">
              {count}
            </span>
            <span className="text-foreground/50 text-xs">
              {count === 1 ? "categoría" : "categorías"}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function countByStatus(
  categories: CategoryHealth[],
): Partial<Record<BudgetHealthStatus, number>> {
  const acc: Partial<Record<BudgetHealthStatus, number>> = {};
  for (const c of categories) {
    // DELAYED rolls up into NOT_STARTED for the tile counter — both indicate
    // "no spend yet", and the L0 tiles intentionally collapse the distinction
    // to keep the four-tile model. Detail views surface DELAYED separately.
    const bucket: BudgetHealthStatus = c.status === "DELAYED" ? "NOT_STARTED" : c.status;
    acc[bucket] = (acc[bucket] ?? 0) + 1;
  }
  return acc;
}
