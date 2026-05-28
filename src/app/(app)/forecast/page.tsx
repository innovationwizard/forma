/**
 * Cash flow forecast — Batch 16a (READ-ONLY first cut).
 *
 *   /forecast
 *
 * Renders the 36-month projection (from `MonthlyProjection`) + 4 returns
 * per D28 + credit facility timeline. Read-only today.
 *
 * **Batch 16b (deferred)** ships editable cells + cascade recompute. Gating
 * decision: Q9 ("IRR/ROI formula cross-check vs xlsx named ranges") needs
 * resolution first — we can't validate an editable model on top of an
 * unverified calc engine. The read-only view IS already useful: it's the
 * analyst's full 36-month picture with all 4 returns disambiguated per D28.
 *
 * All 4 returns labeled LITERALLY per D28 + `feedback_literal_labels_when_multiple_values`:
 *   - "Revenue ÷ Cost" (1.13×, +12.6%)
 *   - "EBITDA margin"  (12.6%)
 *   - "Annualized IRR · 36-mo corrected" + "· 30-mo xlsx (Q-TIRI-WINDOW)"
 *   - "Return on peak equity" (75.6% type figure)
 * Never abbreviated to "ROI" alone.
 */

import Link from "next/link";

import { InfoTooltip } from "@/components/ui/info-tooltip";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadForecastSnapshot } from "@/lib/queries/forecast";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  await requireRole();
  const snapshot = await loadForecastSnapshot(prisma);
  const { projection, project, creditFacility, amortizationRule } = snapshot;
  const ret = projection.returns;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Cash flow forecast
          </h1>
          <span className="text-foreground/60 text-xs tabular-nums">
            {projection.rows.length} months · {project.startDate} → {project.projectedEndDate}
          </span>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          The 36-month financial model from the canonical xlsx, with derived
          cumulative series + four disambiguated return figures per D28. Read-only
          in this version; cell editing + cascade recompute land in a follow-up
          (Batch 16b — gated on Q9 IRR formula verification).
        </p>
      </header>

      {/* ── Returns card (per D28) ─────────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">
          Returns (4 figures · disambiguated per D28)
        </h2>
        <p className="text-foreground/50 mt-1 text-xs">
          Per <code>feedback_literal_labels_when_multiple_values</code>, none of
          these is labeled simply &quot;ROI&quot; — each carries its own literal
          token so the four can&apos;t be confused.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReturnCard
            title="Revenue ÷ Cost"
            value={`${Number(ret.revenueToCostRatio).toFixed(4)}×`}
            sub={`+${formatPct(ret.revenueToCostMarginPct)} above cost`}
            note="Ratio (not margin). H47/H22 per D28 #1."
          />
          <ReturnCard
            title="EBITDA margin"
            value={formatPct(ret.ebitdaMarginPct)}
            sub={`EBITDA / Total cost`}
            note="H55/H22 per D28 #2."
          />
          <IrrCard
            irrAnnualizedFull={ret.irrAnnualizedFull}
            irrAnnualizedXlsx={ret.irrAnnualizedXlsx}
          />
          <ReturnCard
            title="Return on peak equity"
            value={formatPct(ret.returnOnPeakEquity)}
            sub={`Peak equity: ${formatUsd(ret.peakEquityUsd)}`}
            note="Total EBITDA / |min(cum EBITDA)| per D28 #4."
          />
        </div>
      </section>

      {/* ── Aggregate totals ───────────────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Totals</h2>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Total cost (sin IVA)" value={formatUsd(projection.totals.totalCostSinIvaUsd)} />
          <Stat label="Total revenue (sin IVA)" value={formatUsd(projection.totals.totalRevenueSinIvaUsd)} />
          <Stat label="Total IVA on costs" value={formatUsd(projection.totals.totalIvaOnCostsUsd)} />
          <Stat label="Total EBITDA" value={formatUsd(projection.totals.totalEbitdaUsd)} />
        </dl>
      </section>

      {/* ── Credit facility ────────────────────────────────────────────── */}
      {creditFacility != null ? (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <h2 className="text-foreground text-base font-semibold">Credit facility</h2>
          <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="Lender" value={creditFacility.lenderName} />
            <Stat label="Initial cap" value={formatUsd(creditFacility.initialCapUsd)} />
            <Stat label="Annual rate" value={formatPct(creditFacility.annualRate)} />
            <Stat
              label="Amortization mechanism"
              value={amortizationRule?.mechanism.toLowerCase().replace(/_/g, " ") ?? "—"}
            />
          </dl>
        </section>
      ) : null}

      {/* ── 36-month projection table ──────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">36-month projection</h2>
        <p className="text-foreground/50 mt-1 text-xs">
          Cost / Revenue / EBITDA per month, cumulative series, and credit
          facility flow. Read-only — cell editing lands in Batch 16b.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="text-foreground/80 w-full text-xs">
            <thead>
              <tr className="border-foreground/10 text-foreground/60 border-b text-left font-medium tracking-wide uppercase">
                <th scope="col" className="py-2 pr-2">M</th>
                <th scope="col" className="py-2 pr-2">Month</th>
                <th scope="col" className="py-2 pr-2 text-right">Cost</th>
                <th scope="col" className="py-2 pr-2 text-right">Revenue</th>
                <th scope="col" className="py-2 pr-2 text-right">EBITDA</th>
                <th scope="col" className="py-2 pr-2 text-right">Cum cost</th>
                <th scope="col" className="py-2 pr-2 text-right">Cum revenue</th>
                <th scope="col" className="py-2 pr-2 text-right">Cum EBITDA</th>
                <th scope="col" className="py-2 pr-2 text-right">Credit bal.</th>
                <th scope="col" className="py-2 pr-2 text-right">Interest</th>
                <th scope="col" className="py-2 text-right">Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {projection.rows.map((row) => {
                const ebitda = Number(row.ebitdaUsd);
                const cumEbitda = Number(row.cumulativeEbitdaUsd);
                return (
                  <tr key={row.monthNumber}>
                    <td className="text-foreground py-1.5 pr-2 font-mono">M{row.monthNumber}</td>
                    <td className="text-foreground/60 py-1.5 pr-2">{row.monthDate}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {Number(row.costSinIvaUsd) > 0 ? formatUsd(row.costSinIvaUsd) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {Number(row.revenueSinIvaUsd) > 0 ? formatUsd(row.revenueSinIvaUsd) : "—"}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 pr-2 text-right tabular-nums",
                        ebitda < 0 ? "text-red-700" : ebitda > 0 ? "text-emerald-700" : "",
                      )}
                    >
                      {ebitda !== 0 ? formatUsd(row.ebitdaUsd) : "—"}
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 text-right tabular-nums">
                      {formatUsd(row.cumulativeCostSinIvaUsd)}
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 text-right tabular-nums">
                      {formatUsd(row.cumulativeRevenueSinIvaUsd)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 pr-2 text-right tabular-nums",
                        cumEbitda < 0 ? "text-red-700" : "text-foreground",
                      )}
                    >
                      {formatUsd(row.cumulativeEbitdaUsd)}
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 text-right tabular-nums">
                      {Number(row.creditBalanceUsd) > 0 ? formatUsd(row.creditBalanceUsd) : "—"}
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 text-right tabular-nums">
                      {Number(row.interestPaymentUsd) > 0 ? formatUsd(row.interestPaymentUsd) : "—"}
                    </td>
                    <td className="text-foreground/70 py-1.5 text-right tabular-nums">
                      {Number(row.principalPaymentUsd) > 0 ? formatUsd(row.principalPaymentUsd) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ReturnCard({
  title,
  value,
  sub,
  note,
  accent = "neutral",
}: {
  title: string;
  value: string;
  sub: string;
  note: string;
  accent?: "neutral" | "discrepancy";
}) {
  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/50 rounded-xl border p-4",
        accent === "discrepancy" && "ring-amber-200 ring-1 ring-inset",
      )}
    >
      <h3 className="text-foreground/60 text-[10px] font-medium tracking-wider uppercase">{title}</h3>
      <div className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <p className="text-foreground/70 mt-2 text-xs">{sub}</p>
      <p className="text-foreground/40 mt-3 text-[10px]">{note}</p>
    </div>
  );
}

/**
 * IRR card with (i) tooltips next to each IRR number. Two figures live here:
 *   1. 36-mo corrected — the headline, computed over months 1..36.
 *   2. 30-mo xlsx — the truncated value reproduced from the workbook's I97
 *      formula window (Q-TIRI-WINDOW: the formula stops at M30).
 * Both share the same math but operate on different windows, so each gets its
 * own tooltip explaining the computation.
 */
function IrrCard({
  irrAnnualizedFull,
  irrAnnualizedXlsx,
}: {
  irrAnnualizedFull: string | null;
  irrAnnualizedXlsx: string | null;
}) {
  const discrepancy =
    irrAnnualizedFull != null &&
    irrAnnualizedXlsx != null &&
    Math.abs(Number(irrAnnualizedFull) - Number(irrAnnualizedXlsx)) > 0.02;
  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/50 rounded-xl border p-4",
        discrepancy && "ring-amber-200 ring-1 ring-inset",
      )}
    >
      <h3 className="text-foreground/60 text-[10px] font-medium tracking-wider uppercase">
        Annualized IRR · 36-mo corrected
      </h3>
      <div className="text-foreground mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        <span>{irrAnnualizedFull != null ? formatPct(irrAnnualizedFull) : "—"}</span>
        <InfoTooltip label="How is the 36-mo IRR calculated?">
          <p className="font-medium">Annualized IRR · 36-mo corrected</p>
          <p className="text-foreground/70 mt-1.5">
            Internal Rate of Return computed over the full 36-month EBITDA
            series, then annualized.
          </p>
          <ul className="text-foreground/70 mt-2 list-disc space-y-1 pl-4">
            <li>
              Input: monthly EBITDA (post-IVA-SAT) for M1..M36, treated as a
              cash-flow series starting at M0 = 0.
            </li>
            <li>
              IRR solves for{" "}
              <span className="font-mono">r</span>
              {" "}such that{" "}
              <span className="font-mono">NPV = Σ cf[t] / (1+r)^t = 0</span>
              {" "}across t = 0..36.
            </li>
            <li>
              Solver: Newton-Raphson with a bisection fallback when the
              derivative is flat. Returns null when the series has no sign
              change (no break-even crossing).
            </li>
            <li>
              Annualized:{" "}
              <span className="font-mono">irr_annual = irr_monthly × 12</span>.
            </li>
          </ul>
          <p className="text-foreground/50 mt-2 text-[10px]">
            Per D28 #3. Differs from the xlsx because the xlsx uses partner-cash-flow
            (row 82), not EBITDA — both windows surfaced for cross-check.
          </p>
        </InfoTooltip>
      </div>
      <p className="text-foreground/70 mt-2 flex items-center gap-1.5 text-xs">
        {irrAnnualizedXlsx != null ? (
          <>
            <span>xlsx as-written (30-mo window): {formatPct(irrAnnualizedXlsx)}</span>
            <InfoTooltip label="How is the 30-mo xlsx IRR calculated?">
              <p className="font-medium">xlsx 30-mo IRR · as-written</p>
              <p className="text-foreground/70 mt-1.5">
                Reproduces the xlsx I97 formula{" "}
                <span className="font-mono">IRR(K95:AN95) × 12</span> — same
                math as the 36-mo figure but truncated at M30 instead of M36.
              </p>
              <ul className="text-foreground/70 mt-2 list-disc space-y-1 pl-4">
                <li>
                  Window: months 1..30 only (xlsx I97 stops at col AN; should be
                  AT for the full 36-month timeline).
                </li>
                <li>
                  Same Newton-Raphson + bisection solver as the corrected
                  figure; just a shorter cash-flow series.
                </li>
                <li>
                  Annualized:{" "}
                  <span className="font-mono">irr_annual = irr_monthly × 12</span>.
                </li>
              </ul>
              <p className="text-foreground/50 mt-2 text-[10px]">
                Q-TIRI-WINDOW: surfaced as-modeled per D31 + the corrected
                36-mo figure for comparison.
              </p>
            </InfoTooltip>
          </>
        ) : (
          <span>xlsx 30-mo: insufficient sign change</span>
        )}
      </p>
      <p className="text-foreground/40 mt-3 text-[10px]">
        IRR(monthly EBITDA, 0) × 12 per D28 #3. Q-TIRI-WINDOW: xlsx I97 truncates at M30.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
