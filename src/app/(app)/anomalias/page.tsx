/**
 * Anomalies (DataQualityFlag) listing — wired up when the user clicks an
 * AnomalyBadges chip on the dashboard.
 *
 *   /anomalias?severity=ERROR_VISIBLE
 *
 * Read-only today (per D8 + D21 the flag rows are immutable history;
 * resolution lands in a follow-up). The page exists so the chip doesn't
 * lead to a dead-end — the user gets an actionable list of what's
 * driving the count.
 */

import Link from "next/link";

import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { formatIsoDate } from "@/lib/format";
import { loadAnomalies, type AnomalyRow } from "@/lib/queries/anomalies";
import { cn } from "@/lib/utils";

import type { DataQualityFlagSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_SEVERITIES: readonly DataQualityFlagSeverity[] = [
  "ERROR_BLOCKING",
  "ERROR_VISIBLE",
  "WARNING",
  "INFO",
];

const SEVERITY_ORDER: readonly DataQualityFlagSeverity[] = VALID_SEVERITIES;

const SEVERITY_LABEL: Record<DataQualityFlagSeverity, string> = {
  ERROR_BLOCKING: "Bloqueante",
  ERROR_VISIBLE: "Acción requerida",
  WARNING: "Advertencia",
  INFO: "Información",
};

const SEVERITY_PILL: Record<DataQualityFlagSeverity, string> = {
  ERROR_BLOCKING: "bg-red-100 text-red-900 ring-red-300",
  ERROR_VISIBLE: "bg-red-50 text-red-900 ring-red-200",
  WARNING: "bg-amber-50 text-amber-900 ring-amber-200",
  INFO: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

const SEVERITY_ICON: Record<DataQualityFlagSeverity, string> = {
  ERROR_BLOCKING: "■",
  ERROR_VISIBLE: "▲",
  WARNING: "▲",
  INFO: "•",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnomaliesPage({ searchParams }: PageProps) {
  await requireRole();
  const search = await searchParams;

  const severity = parseSeverity(oneOf(search["severity"]));
  const includeResolved = oneOf(search["resolved"]) === "1";

  const snapshot = await loadAnomalies(prisma, { severity, includeResolved });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Volver al tablero
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            ANOMALÍAS
          </h1>
                  </div>
        <p className="text-foreground/60 mt-1 text-sm">
          {snapshot.totalActive} bandera{snapshot.totalActive === 1 ? "" : "s"} activa
          {snapshot.totalActive === 1 ? "" : "s"} en total. Cada bandera describe una
          contradicción o valor sospechoso capturado por el parser per D31 —
          el archivo se carga verbatim y las anomalías aparecen aquí en vez
          de detener el ingreso.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <SeverityFilter active={severity} counts={snapshot.countsBySeverity} />
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">
            {severity != null
              ? `${SEVERITY_LABEL[severity]} (${snapshot.rows.length})`
              : `Todas (${snapshot.rows.length})`}
          </h2>
          <Link
            href={`/anomalias${includeResolved ? "" : "?resolved=1"}${severity != null ? `${includeResolved ? "?" : "&"}severity=${severity}` : ""}`}
            className="text-foreground/60 hover:text-foreground text-xs underline"
          >
            {includeResolved ? "Ocultar resueltas" : "Mostrar resueltas"}
          </Link>
        </div>

        {snapshot.rows.length === 0 ? (
          <p className="text-foreground/60 mt-3 text-sm">
            Sin banderas que coincidan con los filtros actuales.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {snapshot.rows.map((row) => (
              <AnomalyCard key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SeverityFilter({
  active,
  counts,
}: {
  active: DataQualityFlagSeverity | null;
  counts: Record<DataQualityFlagSeverity, number>;
}) {
  return (
    <>
      <Link
        href="/anomalias"
        className={cn(
          "rounded-full px-3 py-1 text-xs ring-1 ring-inset",
          active == null
            ? "bg-foreground text-background ring-foreground"
            : "bg-background text-foreground/70 ring-zinc-200 hover:bg-zinc-50",
        )}
      >
        Todas
      </Link>
      {SEVERITY_ORDER.map((s) => {
        const count = counts[s];
        const isActive = active === s;
        return (
          <Link
            key={s}
            href={`/anomalias?severity=${s}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs ring-1 ring-inset",
              isActive
                ? "bg-foreground text-background ring-foreground"
                : SEVERITY_PILL[s],
              count === 0 && !isActive && "opacity-50",
            )}
          >
            <span aria-hidden className="mr-1">{SEVERITY_ICON[s]}</span>
            {count} {SEVERITY_LABEL[s]}
          </Link>
        );
      })}
    </>
  );
}

function AnomalyCard({ row }: { row: AnomalyRow }) {
  const isResolved = row.resolvedAt != null;
  return (
    <li
      className={cn(
        "border-foreground/10 bg-background/50 rounded-xl border p-4",
        isResolved && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
              SEVERITY_PILL[row.severity],
            )}
          >
            <span aria-hidden className="mr-1">{SEVERITY_ICON[row.severity]}</span>
            {SEVERITY_LABEL[row.severity]}
          </span>
          <span className="text-foreground/70 font-mono text-[10px] tracking-wide uppercase">
            {row.kind}
          </span>
        </div>
        <span className="text-foreground/40 text-[10px] tabular-nums">
          {formatIsoDate(row.raisedAt)}
        </span>
      </div>

      <p className="text-foreground/80 mt-3 text-sm leading-relaxed">{row.humanMessage}</p>

      <dl className="text-foreground/60 mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-foreground/40 min-w-[120px]">Origen (workbook):</dt>
          <dd className="font-mono">{row.sourceWorkbookRef}</dd>
        </div>
        {row.sourceValue != null ? (
          <div className="flex gap-2">
            <dt className="text-foreground/40 min-w-[120px]">Valor original:</dt>
            <dd className="font-mono break-all">{row.sourceValue}</dd>
          </div>
        ) : null}
        {row.recomputedValue != null ? (
          <div className="flex gap-2">
            <dt className="text-foreground/40 min-w-[120px]">Valor app:</dt>
            <dd className="font-mono break-all">{row.recomputedValue}</dd>
          </div>
        ) : null}
        {row.relatedEntityType != null ? (
          <div className="flex gap-2">
            <dt className="text-foreground/40 min-w-[120px]">Entidad asociada:</dt>
            <dd>
              {row.relatedEntityType}
              {row.relatedEntityId != null ? (
                <span className="text-foreground/40"> · {row.relatedEntityId.slice(0, 8)}…</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {isResolved ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-foreground/40 min-w-[120px]">Resuelta:</dt>
            <dd>
              {row.resolvedAt != null ? formatIsoDate(row.resolvedAt) : "—"}
              {row.resolutionNote != null ? (
                <span className="text-foreground/60 ml-2 italic">— {row.resolutionNote}</span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

function oneOf(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseSeverity(v: string | undefined): DataQualityFlagSeverity | null {
  if (v == null) return null;
  return (VALID_SEVERITIES as readonly string[]).includes(v)
    ? (v as DataQualityFlagSeverity)
    : null;
}
