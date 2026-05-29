/**
 * Block 2 — revenue summary per D27 (mirrors `FCFCasas2!A27:J51` on
 * the L0 dashboard).
 *
 * Top-of-block: total projected revenue + realized-to-date + unit counts.
 * Below: per-unit sale/delivery schedule for all 11 RvUnits. Sold rows
 * are visually emphasized vs available rows. Casa 5 + Casa 6 are
 * presented in the canonical name-sorted order (no special treatment in
 * the L0 view — the Casa 6 anomaly is flagged via AnomalyBadges, not by
 * highlighting the row here).
 */

import Link from "next/link";

import type { RevenueMetrics } from "@/lib/calc/types";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RevenueBlockProps {
  revenue: RevenueMetrics;
}

export function RevenueBlock({ revenue }: RevenueBlockProps) {
  const totalProjected = Number(revenue.totalProjectedSinIvaUsd);
  const realized = Number(revenue.realizedToDateUsd);
  const realizedFraction = totalProjected > 0 ? realized / totalProjected : 0;

  return (
    <section
      aria-labelledby="revenue-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 id="revenue-title" className="text-foreground text-base font-semibold">
            INGRESOS
          </h2>
                  </div>
        <span className="text-foreground/50 text-xs">USD, sin IVA</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total proyectado"
          value={formatUsd(totalProjected)}
          sub={`${revenue.unitCountSold + revenue.unitCountAvailable} unidades en total`}
        />
        <SummaryStat
          label="Realizado a la fecha"
          value={formatUsd(realized)}
          sub={`${formatPct(realizedFraction)} de lo proyectado`}
        />
        <SummaryStat
          label="Vendidas / disponibles"
          value={`${revenue.unitCountSold} / ${revenue.unitCountAvailable}`}
          sub="Bloque canónico vendido = {1, 2, 5, 6, 7, 11}"
        />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="text-foreground/80 w-full text-sm">
          <thead>
            <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
              <th scope="col" className="py-2 pr-3 font-medium">Unidad</th>
              <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Precio</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Mes de venta</th>
              <th scope="col" className="py-2 text-right font-medium">Mes de entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {revenue.perUnit.map((u) => {
              const isSold = u.status === "SOLD";
              return (
                <tr key={u.name} className={cn(isSold ? "bg-emerald-50/40" : undefined)}>
                  <td className="text-foreground py-2 pr-3 font-medium">
                    <Link
                      href={`/casa/${u.id}/conciliacion`}
                      className="hover:underline"
                      aria-label={`Abrir conciliación de ${u.name}`}
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                        isSold
                          ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
                          : "bg-zinc-100 text-zinc-700 ring-zinc-200",
                      )}
                    >
                      {salesStatusLabel(u.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatUsd(u.salePriceSinIvaUsd)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {u.saleMonth ?? "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {u.deliveryMonth ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-foreground/5 bg-background/50 rounded-xl border p-3">
      <div className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="text-foreground mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-foreground/50 mt-0.5 text-xs">{sub}</div>
    </div>
  );
}

/// SOLD/AVAILABLE/SOFT_HOLD/RESERVED/FROZEN → display labels (per CanonicalTaxonomy + D9).
function salesStatusLabel(status: string): string {
  switch (status) {
    case "SOLD":
      return "VENDIDA";
    case "AVAILABLE":
      return "DISPONIBLE";
    case "SOFT_HOLD":
      return "RESERVA TENTATIVA";
    case "RESERVED":
      return "RESERVADA";
    case "FROZEN":
      return "CONGELADA";
    default:
      return status;
  }
}
