/**
 * Level 1 category-detail header card per SDD §5.
 *
 * Same visual language as the L0 dashboard: emerald/amber/red/zinc status
 * palette + ▲/•/◷/○ icons (3 a11y channels). Mirrors `CategoryBars` row
 * styling so the click-through from L0 feels continuous.
 *
 * Includes a back link to `/` and the over-by-$ delta when the category is
 * OVER_BUDGET (the headline number a CEO wants on this page).
 */

import Link from "next/link";

import { statusStyle } from "@/components/dashboard/status-style";
import type { CategoryHealth } from "@/lib/calc/types";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CategoryHeaderProps {
  category: {
    code: string;
    name: string;
    health: CategoryHealth;
  };
}

export function CategoryHeader({ category }: CategoryHeaderProps) {
  const style = statusStyle(category.health.status);
  const pct = Number(category.health.pctConsumed);
  const remaining = Number(category.health.remainingUsd);
  const isOver = category.health.status === "OVER_BUDGET";

  return (
    <section
      aria-labelledby="category-header-title"
      className={cn(
        "border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm",
        style.rowClass,
      )}
    >
      <Link
        href="/"
        className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1
            id="category-header-title"
            className="text-foreground text-2xl font-semibold tracking-tight"
          >
            {category.name}
          </h1>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
              style.badgeClass,
            )}
          >
            <span aria-hidden className="mr-1">{style.icon}</span>
            {style.label}
          </span>
        </div>
        <span className="text-foreground/40 font-mono text-xs">{category.code}</span>
      </div>

      <dl className="text-foreground mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Budget" value={formatUsd(category.health.budgetUsd)} />
        <Stat label="Spent" value={formatUsd(category.health.spentUsd)} />
        <Stat
          label={isOver ? "Over by" : "Remaining"}
          value={formatUsd(Math.abs(remaining))}
          accent={isOver ? "negative" : "neutral"}
        />
        <Stat label="% consumed" value={formatPct(pct)} accent={isOver ? "negative" : "neutral"} />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "negative";
}) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          accent === "negative" ? "text-red-700" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
