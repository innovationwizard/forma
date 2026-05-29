/**
 * Inbox listing page — Batch 13b.
 *
 *   /inbox
 *
 * Lists all UNCLASSIFIED `BankTransaction` rows. Each row links to its
 * detail page (`/inbox/[id]`) where the classification widgets live.
 *
 * Replaces the `CASA` / `COMISION` annotation step Ronny does today on the
 * consolidated workbook's `$ abr26` + `Q abr26` sheets.
 */

import Link from "next/link";

import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadInbox } from "@/lib/queries/inbox";
import { can } from "@/lib/rbac/matrix";
import { formatIsoDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const { role } = await requireRole();
  const canClassify = can(role, "UPDATE", "bank_transaction");
  const inbox = await loadInbox(prisma);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            ← Volver al tablero
          </Link>
          <div className="mt-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              BANDEJA DE CLASIFICACIÓN
            </h1>
                      </div>
          <p className="text-foreground/60 mt-1 text-sm">
            {inbox.unclassifiedCount} transacc{inbox.unclassifiedCount === 1 ? "ión" : "iones"} bancaria{inbox.unclassifiedCount === 1 ? "" : "s"} sin clasificar.
          </p>
        </div>
        <Link
          href="/import/new"
          className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          + Importar estado
        </Link>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        {inbox.rows.length === 0 ? (
          <p className="text-foreground/60 text-sm">
            Nada pendiente. Todas las transacciones bancarias han sido clasificadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-foreground/80 w-full text-sm">
              <thead>
                <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Cuenta</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Descripción</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Ref.</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Archivo origen</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Monto</th>
                  <th scope="col" className="py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {inbox.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="text-foreground py-2 pr-3 tabular-nums">
                      {formatIsoDate(r.transactionDate)}
                    </td>
                    <td className="text-foreground/70 py-2 pr-3 text-xs">
                      {r.bankAccount.displayName}
                    </td>
                    <td className="text-foreground/80 max-w-md truncate py-2 pr-3" title={r.description}>
                      {r.description}
                    </td>
                    <td className="text-foreground/60 py-2 pr-3 font-mono text-[10px]">
                      {r.reference ?? "—"}
                    </td>
                    <td className="text-foreground/50 py-2 pr-3 text-[10px]">
                      <span title={r.importFileName}>
                        {truncateMid(r.importFileName, 30)}
                      </span>
                      <span className="text-foreground/30"> · {r.sheetName.slice(0, 20)}</span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={cn(
                            "tabular-nums",
                            r.direction === "CREDIT" ? "text-emerald-700" : "text-foreground",
                          )}
                        >
                          {r.direction === "CREDIT" ? "+" : ""}
                          {r.currency === "USD" ? "$" : "Q"}
                          {abs(r.amountSigned)}
                        </span>
                        <span className="text-foreground/40 text-[10px]">
                          ≈ {formatUsd(r.amountAbsUsdEstimate)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      {canClassify ? (
                        <Link
                          href={`/inbox/${r.id}`}
                          className="bg-foreground text-background rounded-md px-2.5 py-1 text-xs font-medium"
                        >
                          Clasificar
                        </Link>
                      ) : (
                        <span className="text-foreground/40 text-xs">solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function abs(decimalString: string): string {
  const n = Number(decimalString);
  if (!Number.isFinite(n)) return decimalString;
  return Math.abs(n).toFixed(2);
}

function truncateMid(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`;
}
