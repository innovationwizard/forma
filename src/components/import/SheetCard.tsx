"use client";

/**
 * Per-sheet card on the import detail page. Shows detection results,
 * row counts, and the canonical/alternate toggle.
 *
 * The "Make canonical" button is the user-facing handle for Jorge directive
 * #2 — flipping it triggers `flipCanonicalAction` which re-derives silver
 * from this sheet's bronze rows (soft-deleting the old canonical's silver
 * along the way).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { flipCanonicalAction } from "@/app/(app)/import/[id]/actions";
import { cn } from "@/lib/utils";

interface SheetCardProps {
  sheet: {
    id: string;
    sheetName: string;
    sheetIndex: number;
    rowCount: number;
    parseStatus: string;
    parseNote: string | null;
    statementType: string;
    detectedCurrency: string | null;
    detectedPeriodStart: string | null;
    detectedPeriodEnd: string | null;
    detectedAccount: { id: string; displayName: string; accountNumber: string } | null;
    isCanonical: boolean;
    rawRowsCount: number;
    silverRowsCount: number;
  };
  canFlip: boolean;
  hasPeers: boolean;
}

export function SheetCard({ sheet, canFlip, hasPeers }: SheetCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleFlip() {
    setError(null);
    if (!confirm(`¿Hacer canónica la hoja "${sheet.sheetName}"?\n\nEsto vuelve a derivar la capa plata: las filas plata de la canónica actual se eliminan suavemente, y la capa plata se recalcula a partir de las filas bronce de esta hoja.`))
      return;
    startTransition(async () => {
      const result = await flipCanonicalAction({ sheetId: sheet.id });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "border-foreground/10 rounded-xl border p-4",
        sheet.isCanonical ? "bg-emerald-50/30" : "bg-background/40",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground/40 font-mono text-xs">#{sheet.sheetIndex}</span>
          <h3 className="text-foreground text-sm font-medium">{sheet.sheetName}</h3>
          {sheet.isCanonical ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase text-emerald-900 ring-1 ring-emerald-200 ring-inset">
              Canónica
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-700 ring-1 ring-zinc-200 ring-inset">
              Alterna
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
              sheet.parseStatus === "PARSED"
                ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                : sheet.parseStatus === "EMPTY"
                  ? "bg-zinc-50 text-zinc-500 ring-zinc-200"
                  : "bg-amber-50 text-amber-900 ring-amber-200",
            )}
          >
            {parseStatusLabel(sheet.parseStatus)}
          </span>
        </div>
      </header>

      <dl className="text-foreground/70 mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Stat label="Filas en el archivo" value={sheet.rowCount.toString()} />
        <Stat label="Bronce capturadas" value={sheet.rawRowsCount.toString()} />
        <Stat label="Plata promovidas" value={sheet.silverRowsCount.toString()} />
        <Stat
          label="Tipo de estado"
          value={sheet.statementType.toLowerCase().replace(/_/g, " ")}
        />
        <Stat label="Moneda" value={sheet.detectedCurrency ?? "—"} />
        <Stat
          label="Cuenta"
          value={sheet.detectedAccount ? sheet.detectedAccount.displayName : "—"}
        />
        <Stat label="Periodo inicia" value={sheet.detectedPeriodStart ?? "—"} />
        <Stat label="Periodo termina" value={sheet.detectedPeriodEnd ?? "—"} />
      </dl>

      {sheet.parseNote != null ? (
        <p className="text-foreground/60 mt-3 text-xs italic">{sheet.parseNote}</p>
      ) : null}

      {canFlip && !sheet.isCanonical && hasPeers && sheet.parseStatus === "PARSED" ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleFlip}
            className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-3 py-1.5 text-xs font-medium"
          >
            {pending ? "Re-derivando capa plata…" : "Hacer canónica"}
          </button>
          {error != null ? (
            <span role="alert" className="text-xs text-red-700">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function parseStatusLabel(s: string): string {
  switch (s) {
    case "PARSED":
      return "PROCESADA";
    case "EMPTY":
      return "VACÍA";
    case "WARN":
    case "WARNING":
      return "ADVERTENCIA";
    case "ERROR":
      return "ERROR";
    default:
      return s;
  }
}
