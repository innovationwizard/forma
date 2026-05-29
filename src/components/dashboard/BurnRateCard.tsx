/**
 * Burn-rate summary per SDD §7.2.
 *
 * Shows two numbers — average monthly burn (since project start) + trailing
 * 3-month burn — and a forward-looking signal (on-budget projection y/n).
 * The on-budget signal is informational per Q-LTC-CEILING-style framing:
 * it surfaces concern, doesn't alarm.
 */

import type { BurnRateMetrics } from "@/lib/calc/types";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BurnRateCardProps {
  burnRate: BurnRateMetrics;
}

export function BurnRateCard({ burnRate }: BurnRateCardProps) {
  const onTrack = burnRate.onBudgetProjection;
  return (
    <section
      aria-labelledby="burn-rate-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-5 shadow-sm"
    >
      <div>
        <h2
          id="burn-rate-title"
          className="text-foreground/60 text-xs font-medium tracking-wider uppercase"
        >
          RITMO DE GASTO
        </h2>
              </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-foreground text-3xl font-semibold tabular-nums">
          {formatUsd(burnRate.monthlyBurnUsd)}
        </span>
        <span className="text-foreground/60 text-xs">/ mes prom.</span>
      </div>

      <dl className="text-foreground/70 mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-foreground/50">Últimos 3 meses</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(burnRate.trailing3moUsd)}
        </dd>
        <dt className="text-foreground/50">Meses transcurridos</dt>
        <dd className="text-foreground text-right tabular-nums">{burnRate.monthsActive}</dd>
        <dt className="text-foreground/50">Meses restantes</dt>
        <dd className="text-foreground text-right tabular-nums">{burnRate.monthsRemaining}</dd>
      </dl>

      <div
        className={cn(
          "mt-4 rounded-md px-3 py-2 text-xs ring-1 ring-inset",
          onTrack
            ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
            : "bg-amber-50 text-amber-900 ring-amber-200",
        )}
      >
        <span aria-hidden className="mr-1">
          {onTrack ? "•" : "▲"}
        </span>
        Total proyectado {onTrack ? "dentro del" : "excede el"} presupuesto al cierre:{" "}
        <span className="font-semibold tabular-nums">
          {formatUsd(burnRate.projectedTotalUsd)}
        </span>
      </div>
    </section>
  );
}
