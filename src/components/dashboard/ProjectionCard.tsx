/**
 * Projection card: extrapolates burn rate to project end. Pairs with
 * BurnRateCard on the L0 grid; the BurnRateCard provides the inputs,
 * this card translates them into a yes/no signal + confidence.
 *
 * Confidence is a coarse, derived signal — not a statistical estimate.
 *   HIGH      = on-budget projection AND trailing-3mo within 10% of average
 *   MODERATE  = on-budget projection AND trailing-3mo within 25% of average
 *   LOW       = either off-budget OR trailing-3mo diverges by > 25%
 *
 * Per the SDD §5 ASCII mock: the dashboard shows "Within budget: YES/NO"
 * and "Confidence: LOW/MODERATE/HIGH".
 */

import type { BurnRateMetrics } from "@/lib/calc/types";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProjectionCardProps {
  burnRate: BurnRateMetrics;
  totalBudgetUsd: string;
}

type Confidence = "HIGH" | "MODERATE" | "LOW";

export function ProjectionCard({ burnRate, totalBudgetUsd }: ProjectionCardProps) {
  const confidence = computeConfidence(burnRate);
  const withinBudget = burnRate.onBudgetProjection;
  const headroom =
    Number(totalBudgetUsd) - Number(burnRate.projectedTotalUsd);

  return (
    <section
      aria-labelledby="projection-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-5 shadow-sm"
    >
      <div>
        <h2
          id="projection-title"
          className="text-foreground/60 text-xs font-medium tracking-wider uppercase"
        >
          CIERRE PROYECTADO
        </h2>
        <p className="text-foreground/40 text-[10px] italic">
          (Pronóstico al final del proyecto)
        </p>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "text-3xl font-semibold tabular-nums",
            withinBudget ? "text-emerald-700" : "text-red-700",
          )}
        >
          {withinBudget ? "SÍ" : "NO"}
        </span>
        <span className="text-foreground/60 text-xs">dentro del presupuesto</span>
      </div>

      <dl className="text-foreground/70 mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-foreground/50">Total proyectado</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(burnRate.projectedTotalUsd)}
        </dd>
        <dt className="text-foreground/50">Presupuesto</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(totalBudgetUsd)}
        </dd>
        <dt className="text-foreground/50">
          {headroom >= 0 ? "Margen disponible" : "Sobregiro"}
        </dt>
        <dd
          className={cn(
            "text-right tabular-nums",
            headroom >= 0 ? "text-foreground" : "text-red-700",
          )}
        >
          {formatUsd(Math.abs(headroom))}
        </dd>
      </dl>

      <div
        className={cn(
          "mt-4 flex items-center justify-between rounded-md px-3 py-2 text-xs ring-1 ring-inset",
          confidenceClass(confidence),
        )}
      >
        <span className="text-foreground/60">Confianza</span>
        <span className="font-semibold uppercase">{confidenceLabel(confidence)}</span>
      </div>
    </section>
  );
}

function computeConfidence(burnRate: BurnRateMetrics): Confidence {
  const avg = Number(burnRate.monthlyBurnUsd);
  const trailing = Number(burnRate.trailing3moUsd);
  if (avg === 0) return burnRate.onBudgetProjection ? "MODERATE" : "LOW";
  const divergence = Math.abs(trailing - avg) / avg;
  if (!burnRate.onBudgetProjection) return "LOW";
  if (divergence > 0.25) return "LOW";
  if (divergence > 0.10) return "MODERATE";
  return "HIGH";
}

function confidenceClass(confidence: Confidence): string {
  switch (confidence) {
    case "HIGH":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "MODERATE":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "LOW":
      return "bg-red-50 text-red-900 ring-red-200";
  }
}

function confidenceLabel(confidence: Confidence): string {
  switch (confidence) {
    case "HIGH":
      return "ALTA";
    case "MODERATE":
      return "MEDIA";
    case "LOW":
      return "BAJA";
  }
}
