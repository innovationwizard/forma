/**
 * Per-house conciliación page — Batch 13c.
 *
 *   /casa/[id]/conciliacion
 *
 * Replaces the manual `C1` / `C2` / `C5-D` / `C6` / `C7` / `C11` sheets
 * Ronny maintains today. For each sold house, shows the planned cuota
 * schedule (from `MonthlyProjection.revenuePerHouse[casaName]`) vs the
 * actual `RvPayment` rows classified from the Inbox, with status pills
 * and cumulative balance.
 *
 * For AVAILABLE units, the page renders the planned schedule + a banner
 * explaining there's no buyer yet.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { reconciliationStyle } from "@/components/casa/reconciliation-style";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadCasaConciliacion } from "@/lib/queries/casa-conciliacion";
import { formatIsoDate, formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ReconciliationMonthRow, ReconciliationStatus } from "@/lib/calc/reconciliation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE_ORDER: ReconciliationStatus[] = [
  "MATCHED",
  "UNDERPAYMENT",
  "OVERPAYMENT",
  "MISSED",
  "UPCOMING",
  "UNEXPECTED_PAYMENT",
  "NO_ACTIVITY",
];

export default async function CasaConciliacionPage({ params }: PageProps) {
  const { id } = await params;
  await requireRole();
  const snapshot = await loadCasaConciliacion(prisma, id);
  if (snapshot == null) notFound();

  const { unit, project, report, noBuyerYet } = snapshot;
  const activeRows = report.rows.filter((r) => r.status !== "NO_ACTIVITY");

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
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {unit.name}
              <span className="text-foreground/40 ml-2 text-sm font-normal">
                {unit.buyer?.name ?? "(comprador no vinculado)"}
              </span>
            </h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                unit.status === "SOLD"
                  ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
                  : "bg-zinc-100 text-zinc-700 ring-zinc-200",
              )}
            >
              {salesStatusLabel(unit.status)}
            </span>
          </div>
          <span className="text-foreground/50 text-xs tabular-nums">
            Proyecto M{project.currentMonth}
          </span>
        </div>
      </header>

      {noBuyerYet ? (
        <p className="bg-amber-50 text-amber-900 ring-amber-200 rounded-md px-3 py-2 text-xs ring-1 ring-inset">
          ▲ Esta unidad está <strong>{salesStatusLabel(unit.status)}</strong> — sin
          comprador vinculado aún, por lo que la columna &quot;Real&quot; será cero a
          lo largo. El calendario planeado abajo es la proyección que FORMA modela
          para un futuro comprador hipotético.
        </p>
      ) : null}

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">RESUMEN</h2>
                  </div>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Precio de venta" value={unit.salePriceSinIvaUsd != null ? formatUsd(unit.salePriceSinIvaUsd) : "—"} />
          <Stat label="Tasa de enganche" value={formatPct(unit.engancheRate)} />
          <Stat label="Mes de venta" value={unit.saleMonth != null ? `M${unit.saleMonth}` : "—"} />
          <Stat label="Mes de entrega" value={unit.deliveryMonth != null ? `M${unit.deliveryMonth}` : "—"} />
          <Stat label="Total planeado" value={formatUsd(report.totals.plannedUsd)} />
          <Stat label="Total pagado" value={formatUsd(report.totals.actualUsd)} />
          <Stat
            label={Number(report.totals.deltaUsd) >= 0 ? "Sobrepago neto" : "Subpago neto"}
            value={formatUsd(Math.abs(Number(report.totals.deltaUsd)))}
            accent={Number(report.totals.deltaUsd) >= 0 ? "positive" : "negative"}
          />
          <Stat
            label="Avance"
            value={formatPct(report.totals.completionRatio)}
          />
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {STATUS_BADGE_ORDER.map((s) => {
            const count = report.counts[s];
            if (count === 0) return null;
            const style = reconciliationStyle(s);
            return (
              <span
                key={s}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  style.pillClass,
                )}
              >
                <span aria-hidden className="mr-1">{style.icon}</span>
                {count} {style.label}
              </span>
            );
          })}
        </div>
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">
            CONCILIACIÓN MENSUAL
          </h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          {activeRows.length} mes{activeRows.length === 1 ? "" : "es"} activo{activeRows.length === 1 ? "" : "s"} ·{" "}
          {report.counts.NO_ACTIVITY} sin actividad · inicio {formatIsoDate(project.startDate)}.
        </p>

        {activeRows.length === 0 ? (
          <p className="text-foreground/60 mt-4 text-sm">
            Sin actividad en el calendario aún. Cuando el primer pago del comprador
            ingrese y sea clasificado desde la Bandeja, aparecerá aquí.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="text-foreground/80 w-full text-sm">
              <thead>
                <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-3 font-medium">M</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Mes</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Planeado</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Real</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Δ</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Saldo</th>
                  <th scope="col" className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {activeRows.map((row) => (
                  <ReconciliationRow key={row.monthNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ReconciliationRow({ row }: { row: ReconciliationMonthRow }) {
  const style = reconciliationStyle(row.status);
  const balanceNum = Number(row.cumulativeBalanceUsd);
  return (
    <>
      <tr className={cn(style.rowClass)}>
        <td className="text-foreground py-2 pr-3 font-mono text-xs">M{row.monthNumber}</td>
        <td className="text-foreground/70 py-2 pr-3 text-xs">
          {formatIsoDate(row.monthDate)}
        </td>
        <td className="text-foreground py-2 pr-3 text-right tabular-nums">
          {Number(row.plannedUsd) > 0 ? formatUsd(row.plannedUsd) : "—"}
        </td>
        <td className="text-foreground py-2 pr-3 text-right tabular-nums">
          {Number(row.actualUsd) > 0 ? formatUsd(row.actualUsd) : "—"}
        </td>
        <td className={cn("py-2 pr-3 text-right tabular-nums", style.textClass)}>
          {Number(row.deltaUsd) !== 0 ? formatUsd(row.deltaUsd) : "—"}
        </td>
        <td
          className={cn(
            "py-2 pr-3 text-right tabular-nums",
            balanceNum < 0 ? "text-red-700" : balanceNum > 0 ? "text-foreground" : "text-foreground/60",
          )}
        >
          {formatUsd(row.cumulativeBalanceUsd)}
        </td>
        <td className="py-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
              style.pillClass,
            )}
          >
            <span aria-hidden className="mr-1">{style.icon}</span>
            {style.label}
          </span>
        </td>
      </tr>
      {row.payments.length > 0 ? (
        <tr className={cn(style.rowClass, "border-foreground/5 border-b")}>
          <td colSpan={7} className="px-3 pb-2">
            <ul className="ml-6 list-disc text-[11px]">
              {row.payments.map((p) => (
                <li key={p.id} className="text-foreground/60">
                  {formatIsoDate(p.paymentDate)} · {formatUsd(p.amountUsd)}
                  {p.bankTransactionId != null ? (
                    <Link
                      href={`/inbox/${p.bankTransactionId}`}
                      className="text-foreground/50 hover:text-foreground ml-2 underline"
                    >
                      desde tx bancaria
                    </Link>
                  ) : (
                    <span className="text-foreground/40 ml-2">(entrada manual)</span>
                  )}
                  {p.notes != null ? (
                    <span className="text-foreground/50 ml-2 italic">— {p.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function salesStatusLabel(s: string): string {
  switch (s) {
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
      return s;
  }
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "positive" | "negative";
}) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          accent === "positive" && "text-emerald-700",
          accent === "negative" && "text-red-700",
          accent === "neutral" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
