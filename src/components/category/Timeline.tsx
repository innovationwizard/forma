"use client";

/**
 * Level 1 cumulative-spend timeline.
 *
 * Two series across the 36-month project window:
 *   - Planned: linear ramp from 0 → category.budgetAmountUsd at project end.
 *     Renders as a line. Per PLAN.md this is the simplest defensible plan
 *     curve until we ingest per-category per-month plan data (which lives
 *     in MonthlyProjection at project level, not category level).
 *   - Actual: cumulative sum of all events (Expenditure + PartnerContribution)
 *     dated through that month. Renders as a filled area.
 *
 * Pre-project events (e.g., 2018 in-kind terreno aportación for TERRENOS)
 * are bucketed at M0 in the query layer — they show up as the starting
 * actual value (the curve is non-zero at M1).
 *
 * Marked client-only because Recharts uses SVG + measured DOM. The server
 * fetches and shapes the data; this component only renders.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatUsd } from "@/lib/format";

interface TimelinePoint {
  monthNumber: number;
  plannedCumulativeUsd: string;
  actualCumulativeUsd: string;
}

interface CategoryTimelineProps {
  timeline: TimelinePoint[];
  currentMonth: number;
}

export function CategoryTimeline({ timeline, currentMonth }: CategoryTimelineProps) {
  // Recharts wants numbers, not decimal-strings, for the axes.
  const data = timeline.map((p) => ({
    month: p.monthNumber,
    planned: Number(p.plannedCumulativeUsd),
    actual: Number(p.actualCumulativeUsd),
  }));

  return (
    <section
      aria-labelledby="timeline-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 id="timeline-title" className="text-foreground text-base font-semibold">
            EJECUCIÓN ACUMULADA
          </h2>
                  </div>
        <div className="text-foreground/60 flex items-center gap-4 text-xs">
          <LegendItem swatchClass="bg-emerald-500/60" label="Real" />
          <LegendItem swatchClass="bg-zinc-400" label="Plan" />
          <span className="text-foreground/40">Mes {currentMonth}</span>
        </div>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
              tickFormatter={(m: number) => `M${m}`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
              tickFormatter={(v: number) => formatCompactUsd(v)}
              width={64}
            />
            <Tooltip
              formatter={(value, name) => [
                formatUsd(typeof value === "number" ? value : Number(value)),
                name === "actual" ? "Real" : "Plan",
              ]}
              labelFormatter={(m) => `Mes ${m}`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="rgb(5, 150, 105)"
              strokeWidth={2}
              fill="rgba(16, 185, 129, 0.25)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="planned"
              stroke="rgb(113, 113, 122)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function LegendItem({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm ${swatchClass}`} />
      {label}
    </span>
  );
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
