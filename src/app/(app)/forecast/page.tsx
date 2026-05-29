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
          ← Volver al tablero
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              PROYECCIÓN DE FLUJO DE CAJA
            </h1>
                      </div>
          <span className="text-foreground/60 text-xs tabular-nums">
            {projection.rows.length} meses · {project.startDate} → {project.projectedEndDate}
          </span>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          El modelo financiero a 36 meses del archivo xlsx canónico, con series acumuladas
          derivadas + cuatro figuras de retorno disambiguadas por D28. Solo lectura
          en esta versión; la edición de celdas + recálculo en cascada llegan en una entrega
          posterior (Batch 16b — sujeto a la verificación Q9 de la fórmula de IRR).
        </p>
      </header>

      {/* ── Returns card (per D28) ─────────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">
            RETORNOS (4 figuras · disambiguadas por D28)
          </h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          Por <code>feedback_literal_labels_when_multiple_values</code>, ninguna se
          etiqueta simplemente como &quot;ROI&quot; — cada una lleva su propio token literal
          para que las cuatro no se confundan.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReturnCard
            title="Ingresos ÷ Costo"
            value={`${Number(ret.revenueToCostRatio).toFixed(4)}×`}
            sub={`+${formatPct(ret.revenueToCostMarginPct)} sobre el costo`}
            note="Razón (no margen). H47/H22 por D28 #1."
          />
          <ReturnCard
            title="Margen EBITDA"
            value={formatPct(ret.ebitdaMarginPct)}
            sub={`EBITDA / Costo total`}
            note="H55/H22 por D28 #2."
          />
          <IrrCard
            irrAnnualizedFull={ret.irrAnnualizedFull}
            irrAnnualizedXlsx={ret.irrAnnualizedXlsx}
          />
          <ReturnCard
            title="Retorno sobre patrimonio pico"
            value={formatPct(ret.returnOnPeakEquity)}
            sub={`Patrimonio pico: ${formatUsd(ret.peakEquityUsd)}`}
            note="EBITDA total / |min(EBITDA acum.)| por D28 #4."
          />
        </div>
      </section>

      {/* ── Aggregate totals ───────────────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">TOTALES</h2>
                  </div>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Costo total (sin IVA)" value={formatUsd(projection.totals.totalCostSinIvaUsd)} />
          <Stat label="Ingresos totales (sin IVA)" value={formatUsd(projection.totals.totalRevenueSinIvaUsd)} />
          <Stat label="IVA total sobre costos" value={formatUsd(projection.totals.totalIvaOnCostsUsd)} />
          <Stat label="EBITDA total" value={formatUsd(projection.totals.totalEbitdaUsd)} />
        </dl>
      </section>

      {/* ── Credit facility ────────────────────────────────────────────── */}
      {creditFacility != null ? (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <div>
            <h2 className="text-foreground text-base font-semibold">CRÉDITO BANCARIO</h2>
                      </div>
          <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="Banco" value={creditFacility.lenderName} />
            <Stat label="Cupo inicial" value={formatUsd(creditFacility.initialCapUsd)} />
            <Stat label="Tasa anual" value={formatPct(creditFacility.annualRate)} />
            <Stat
              label="Mecanismo de amortización"
              value={amortizationRule?.mechanism.toLowerCase().replace(/_/g, " ") ?? "—"}
            />
          </dl>
        </section>
      ) : null}

      {/* ── 36-month projection table ──────────────────────────────────── */}
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">PROYECCIÓN MENSUAL A 36 MESES</h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          Costo / Ingresos / EBITDA por mes, series acumuladas, y flujo del crédito.
          Solo lectura — la edición de celdas llega en Batch 16b.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="text-foreground/80 w-full text-xs">
            <thead>
              <tr className="border-foreground/10 text-foreground/60 border-b text-left font-medium tracking-wide uppercase">
                <th scope="col" className="py-2 pr-2">M</th>
                <th scope="col" className="py-2 pr-2">Mes</th>
                <th scope="col" className="py-2 pr-2 text-right">Costo</th>
                <th scope="col" className="py-2 pr-2 text-right">Ingresos</th>
                <th scope="col" className="py-2 pr-2 text-right">EBITDA</th>
                <th scope="col" className="py-2 pr-2 text-right">Costo acum.</th>
                <th scope="col" className="py-2 pr-2 text-right">Ingresos acum.</th>
                <th scope="col" className="py-2 pr-2 text-right">EBITDA acum.</th>
                <th scope="col" className="py-2 pr-2 text-right">Saldo crédito</th>
                <th scope="col" className="py-2 pr-2 text-right">Interés</th>
                <th scope="col" className="py-2 text-right">Capital</th>
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
        IRR anualizado · 36 meses corregido
      </h3>
      <div className="text-foreground mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        <span>{irrAnnualizedFull != null ? formatPct(irrAnnualizedFull) : "—"}</span>
        <InfoTooltip label="¿Cómo se calcula el IRR a 36 meses?">
          <p className="font-medium">IRR anualizado · 36 meses corregido</p>
          <p className="text-foreground/70 mt-1.5">
            Tasa Interna de Retorno calculada sobre la serie completa de EBITDA
            de 36 meses, luego anualizada.
          </p>
          <ul className="text-foreground/70 mt-2 list-disc space-y-1 pl-4">
            <li>
              Entrada: EBITDA mensual (post-IVA-SAT) para M1..M36, tratado como
              serie de flujos de caja que empieza en M0 = 0.
            </li>
            <li>
              El IRR resuelve para{" "}
              <span className="font-mono">r</span>
              {" "}tal que{" "}
              <span className="font-mono">VAN = Σ fc[t] / (1+r)^t = 0</span>
              {" "}en t = 0..36.
            </li>
            <li>
              Algoritmo: Newton-Raphson con respaldo por bisección cuando la
              derivada es plana. Devuelve nulo cuando la serie no tiene cambio
              de signo (no hay cruce de punto de equilibrio).
            </li>
            <li>
              Anualizado:{" "}
              <span className="font-mono">irr_anual = irr_mensual × 12</span>.
            </li>
          </ul>
          <p className="text-foreground/50 mt-2 text-[10px]">
            Por D28 #3. Difiere del xlsx porque el xlsx usa el flujo de caja del socio
            (fila 82), no EBITDA — ambas ventanas se muestran para validación cruzada.
          </p>
        </InfoTooltip>
      </div>
      <p className="text-foreground/70 mt-2 flex items-center gap-1.5 text-xs">
        {irrAnnualizedXlsx != null ? (
          <>
            <span>xlsx tal como está (ventana 30 meses): {formatPct(irrAnnualizedXlsx)}</span>
            <InfoTooltip label="¿Cómo se calcula el IRR a 30 meses del xlsx?">
              <p className="font-medium">IRR a 30 meses · tal como está en xlsx</p>
              <p className="text-foreground/70 mt-1.5">
                Reproduce la fórmula I97 del xlsx{" "}
                <span className="font-mono">IRR(K95:AN95) × 12</span> — la misma
                matemática que la cifra a 36 meses pero truncada en M30 en vez de M36.
              </p>
              <ul className="text-foreground/70 mt-2 list-disc space-y-1 pl-4">
                <li>
                  Ventana: meses 1..30 únicamente (el xlsx I97 termina en la columna AN;
                  debería ser AT para la línea de tiempo completa de 36 meses).
                </li>
                <li>
                  El mismo algoritmo Newton-Raphson + bisección que la cifra
                  corregida; solo es una serie de flujos más corta.
                </li>
                <li>
                  Annualized:{" "}
                  <span className="font-mono">irr_annual = irr_monthly × 12</span>.
                </li>
              </ul>
              <p className="text-foreground/50 mt-2 text-[10px]">
                Q-TIRI-WINDOW: se muestra tal como está modelado en el archivo por D31,
                junto a la cifra corregida a 36 meses para comparación.
              </p>
            </InfoTooltip>
          </>
        ) : (
          <span>xlsx 30 meses: cambio de signo insuficiente</span>
        )}
      </p>
      <p className="text-foreground/40 mt-3 text-[10px]">
        IRR(EBITDA mensual, 0) × 12 por D28 #3. Q-TIRI-WINDOW: el xlsx I97 trunca en M30.
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
