/**
 * Hero card: overall budget health — the single largest element on Level 0
 * per SDD §5 (the "% REMAINING" headline). Numerator = sum of all
 * BudgetCategory.spentUsd across the canonical 11-category dashboard view
 * + system fallbacks (per Batch 7.5 the system categories also represent
 * spend, but they are filtered out of the L0 bar list per
 * `dashboardVisible=false`; they ARE included in the overall total).
 *
 * Per D25 the headline number is "remaining %", not "spent %", because the
 * CEO's mental model is "how much runway is left." The progress bar
 * visualizes the inverse (spent fraction).
 */

import { formatPct, formatUsd } from "@/lib/format";

interface HealthHeaderProps {
  totalBudgetUsd: string;
  totalSpentUsd: string;
}

export function HealthHeader({ totalBudgetUsd, totalSpentUsd }: HealthHeaderProps) {
  const budget = Number(totalBudgetUsd);
  const spent = Number(totalSpentUsd);
  const spentFraction = budget > 0 ? spent / budget : 0;
  const remainingFraction = Math.max(0, 1 - spentFraction);
  const clampedSpentBar = Math.min(1, Math.max(0, spentFraction));

  return (
    <section
      aria-labelledby="health-header-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="health-header-title"
          className="text-foreground/60 text-xs font-medium tracking-wider uppercase"
        >
          Budget health
        </h2>
        <span className="text-foreground/60 text-xs">USD, sin IVA</span>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-foreground text-5xl font-semibold tracking-tight tabular-nums">
          {formatPct(remainingFraction)}
        </span>
        <span className="text-foreground/60 text-base">remaining</span>
      </div>

      <div
        className="border-foreground/10 mt-5 h-4 w-full overflow-hidden rounded-full border bg-zinc-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number((spentFraction * 100).toFixed(1))}
        aria-label={`${formatPct(spentFraction)} of budget spent`}
      >
        <div
          className="bg-foreground h-full"
          style={{ width: `${(clampedSpentBar * 100).toFixed(2)}%` }}
        />
      </div>

      <div className="text-foreground/70 mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
        <span>
          {formatPct(spentFraction)} spent · {formatUsd(spent)} of {formatUsd(budget)}
        </span>
        <span className="text-foreground/50">
          {formatUsd(budget - spent)} remaining
        </span>
      </div>
    </section>
  );
}
