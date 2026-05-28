/**
 * Per-row classification page — Batch 13b.
 *
 *   /inbox/[id]
 *
 * Shows the BankTransaction in full + the 4-tab classification widget.
 * Server-component shell; widget is `"use client"` for the tab state.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassifyWidget } from "@/components/inbox/ClassifyWidget";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadInboxItem } from "@/lib/queries/inbox";
import { can } from "@/lib/rbac/matrix";
import { formatIsoDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InboxItemPage({ params }: PageProps) {
  const { id } = await params;
  const { role } = await requireRole();
  const canClassify = can(role, "UPDATE", "bank_transaction");
  const snapshot = await loadInboxItem(prisma, id);
  if (snapshot == null) notFound();

  const tx = snapshot.transaction;
  const isInflow = tx.direction === "CREDIT";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/inbox"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Volver a la bandeja
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            CLASIFICAR TRANSACCIÓN BANCARIA
          </h1>
          <p className="text-foreground/40 text-[10px] italic">
            (Asignar movimiento a su categoría)
          </p>
        </div>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                isInflow
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : "bg-zinc-100 text-zinc-700 ring-zinc-200",
              )}
            >
              {tx.direction === "CREDIT" ? "Ingreso" : "Egreso"}
            </span>
            <span className="text-foreground/40 ml-2 font-mono text-xs">
              {tx.reference ?? "sin ref."}
            </span>
          </div>
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            {isInflow ? "+" : "−"}
            {tx.currency === "USD" ? "$" : "Q"}
            {Math.abs(Number(tx.amountSigned)).toFixed(2)}
          </span>
        </div>

        <p className="text-foreground/70 mt-3 text-sm whitespace-pre-line">{tx.description}</p>

        <dl className="text-foreground mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Fecha" value={formatIsoDate(tx.transactionDate)} />
          <Stat label="Cuenta" value={tx.bankAccount.displayName} />
          <Stat label="Moneda" value={tx.currency} />
          <Stat label="USD est." value={formatUsd(tx.amountAbsUsd)} />
          {tx.agencia != null ? <Stat label="Agencia" value={tx.agencia} /> : null}
          {tx.saldoAfter != null ? <Stat label="Saldo posterior" value={tx.saldoAfter} /> : null}
          <Stat
            label="Archivo origen"
            value={`${tx.importFileName} · ${tx.sheetName} · fila ${tx.sourceRowNumber}`}
          />
        </dl>
      </section>

      {canClassify ? (
        <ClassifyWidget snapshot={snapshot} />
      ) : (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <p className="text-foreground/70 text-sm">
            Tu rol ({role}) no puede clasificar transacciones bancarias. El servidor lo
            aplica; los widgets de clasificación están ocultos.
          </p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
