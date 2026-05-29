/**
 * Import detail page — Batch 13a.
 *
 *   /import/[id]
 *
 * Shows: import header (file name, hash, uploader, detected bank) + per-sheet
 * cards (canonical/alternate, row counts, detection) + DataQualityFlags
 * raised during ingest.
 *
 * The twin-sheet decision UI lives on `SheetCard` — clicking "Make canonical"
 * triggers `flipCanonicalAction` which re-derives silver per Jorge directive #2.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { SheetCard } from "@/components/import/SheetCard";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadImportDetail } from "@/lib/queries/import-detail";
import { can } from "@/lib/rbac/matrix";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ImportDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;
  const isDup = search["dup"] === "1";

  const { role } = await requireRole();
  const snapshot = await loadImportDetail(prisma, id);
  if (snapshot == null) notFound();

  const canFlip = can(role, "UPDATE", "bank_statement_sheet");

  // Detect twin-sheet sets so we only show the toggle when there's a peer
  // available to flip with.
  const peerCountByGroup = new Map<string, number>();
  for (const s of snapshot.sheets) {
    if (s.detectedAccount == null || s.detectedCurrency == null) continue;
    const key = `${s.detectedAccount.id}|${s.detectedCurrency}`;
    peerCountByGroup.set(key, (peerCountByGroup.get(key) ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/import/new"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Cargar otro estado
        </Link>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
          {snapshot.fileName}
        </h1>
        <p className="text-foreground/60 mt-1 text-sm">
          Banco detectado: <strong>{snapshot.detectedBank}</strong> · Cargado por{" "}
          {snapshot.uploadedBy?.fullName ?? "(desconocido)"} ·{" "}
          {new Date(snapshot.uploadedAt).toLocaleString("es-GT")}
        </p>
        {isDup ? (
          <p className="bg-amber-50 text-amber-900 ring-amber-200 mt-3 rounded-md px-3 py-2 text-xs ring-1 ring-inset">
            ▲ Este archivo ya había sido cargado antes (coincide por hash de contenido).
            Mostrando la importación existente.
          </p>
        ) : null}
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">RESUMEN</h2>
                  </div>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Hojas" value={snapshot.sheets.length.toString()} />
          <Stat label="Filas bronce" value={snapshot.totals.rawRows.toString()} />
          <Stat label="Filas plata" value={snapshot.totals.silverRows.toString()} />
          <Stat
            label="Duplicados marcados"
            value={snapshot.totals.duplicatesFlagged.toString()}
            accent={snapshot.totals.duplicatesFlagged > 0 ? "info" : "neutral"}
          />
          <Stat
            label="Advertencias del parser"
            value={snapshot.totals.parserWarnings.toString()}
            accent={snapshot.totals.parserWarnings > 0 ? "warning" : "neutral"}
          />
          <Stat label="Tamaño del archivo" value={`${(snapshot.fileSizeBytes / 1024).toFixed(1)} KB`} />
          <Stat label="Hash (sha256)" value={snapshot.fileSha256.slice(0, 12) + "…"} />
        </dl>
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">HOJAS</h2>
                  </div>
        <p className="text-foreground/50 mt-1 text-xs">
          Cuando una importación contiene hojas gemelas para la misma cuenta, solo la
          canónica alimenta la capa plata. Usa <strong>Hacer canónica</strong> para
          cambiar — la capa plata se vuelve a derivar automáticamente.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {snapshot.sheets.map((s) => {
            const groupKey =
              s.detectedAccount != null && s.detectedCurrency != null
                ? `${s.detectedAccount.id}|${s.detectedCurrency}`
                : null;
            const hasPeers =
              groupKey != null && (peerCountByGroup.get(groupKey) ?? 0) > 1;
            return (
              <SheetCard
                key={s.id}
                sheet={s}
                canFlip={canFlip}
                hasPeers={hasPeers}
              />
            );
          })}
        </div>
      </section>

      {snapshot.flags.length > 0 ? (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <div>
            <h2 className="text-foreground text-base font-semibold">
              BANDERAS DE CALIDAD DE DATOS ({snapshot.flags.length})
            </h2>
                      </div>
          <p className="text-foreground/50 mt-1 text-xs">
            Por D31 el parser nunca se rompe — las filas raras aparecen aquí en su lugar.
            Resuelve desde la vista de calidad de datos.
          </p>
          <ul className="mt-4 space-y-2">
            {snapshot.flags.map((f) => (
              <li
                key={f.id}
                className="border-foreground/10 bg-background/50 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                        f.severity === "ERROR_BLOCKING" || f.severity === "ERROR_VISIBLE"
                          ? "bg-red-50 text-red-900 ring-red-200"
                          : f.severity === "WARNING"
                            ? "bg-amber-50 text-amber-900 ring-amber-200"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200",
                      )}
                    >
                      {f.severity}
                    </span>
                    <span className="text-foreground/70 font-mono text-[10px]">{f.kind}</span>
                  </div>
                  <span className="text-foreground/50 text-[10px]">
                    {new Date(f.raisedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-foreground/80 mt-2 text-xs">{f.humanMessage}</p>
                <p className="text-foreground/40 mt-1 font-mono text-[10px]">
                  {f.sourceWorkbookRef}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "info" | "warning";
}) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd
        className={cn(
          "text-foreground mt-0.5 text-base font-semibold tabular-nums",
          accent === "warning" && "text-amber-700",
          accent === "info" && "text-foreground/80",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
