/**
 * Level 2 transaction detail card per SDD §5 Level 2.
 *
 * Renders every field on the Expenditure row: amounts (con IVA / sin IVA /
 * IVA), USD reconstruction with the 3-source TC ambiguity (per-tx /
 * booked / locked), source provenance, categorization, status.
 *
 * Server component — receives a fully-shaped `TransactionDetailSnapshot`
 * from the page's loader. Money + percentage formatting via `formatUsd`
 * + `formatPct`. The companion components (`EditForm`, `StatusActions`)
 * are client components that mutate via server actions.
 */

import Link from "next/link";

import type { TransactionDetailSnapshot } from "@/lib/queries/transaction-detail";
import { formatIsoDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DetailProps {
  transaction: TransactionDetailSnapshot;
}

export function TransactionDetailCard({ transaction }: DetailProps) {
  const t = transaction;
  return (
    <section
      aria-labelledby="tx-detail-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <Link
        href={`/category/${encodeURIComponent(t.category.code)}`}
        className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        ← Back to {t.category.name}
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1
            id="tx-detail-title"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            {t.vendorRaw}
          </h1>
          <StatusBadge status={t.status} />
        </div>
        <span className="text-foreground/50 font-mono text-xs">
          {t.sourceWorkbookRef ?? t.id}
        </span>
      </div>

      <p className="text-foreground/70 mt-2 text-sm whitespace-pre-line">
        {t.description}
      </p>

      <dl className="text-foreground mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Stat label="Date" value={formatIsoDate(t.date)} />
        <Stat label="Kind" value={prettyKind(t.kind)} />
        <Stat label="Category" value={t.category.name} />
        <Stat label="Partition" value={t.partition.name} />
      </dl>

      <div className="border-foreground/5 mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Subcard title="Amounts (GTQ)">
          <Row label="Con IVA" value={`Q ${t.amounts.conIvaGtq}`} />
          <Row label="Sin IVA" value={`Q ${t.amounts.sinIvaGtq}`} />
          <Row label="IVA" value={`Q ${t.amounts.ivaGtq}`} />
          <Row label="USD reconstructed" value={formatUsd(t.amounts.usd)} accent />
        </Subcard>

        <Subcard title="Exchange rate (per Detalle egresos finding #11)">
          <Row label="Per-transaction TC" value={t.exchangeRate.perTxTc ?? "(none)"} />
          <Row label="Booked TC" value={t.exchangeRate.bookedTc} />
          <Row label="Project locked TC" value={t.exchangeRate.lockedTc} />
        </Subcard>

        <Subcard title="Counterparty">
          <Row label="Vendor (raw)" value={t.vendorRaw} />
          <Row label="Partner" value={t.partner?.name ?? "(unlinked)"} />
        </Subcard>

        <Subcard title="Bank">
          <Row label="Account" value={t.bankAccount?.displayName ?? "(none / aportación)"} />
          <Row label="Number" value={t.bankAccount?.accountNumber ?? "—"} />
          <Row label="Currency" value={t.bankAccount?.currency ?? "—"} />
        </Subcard>

        <Subcard title="Source & references">
          <Row label="Source" value={prettySource(t.source)} />
          <Row label="Workbook ref" value={t.sourceWorkbookRef ?? "—"} />
          <Row label="Check #" value={t.checkNumber ?? "—"} />
          <Row label="Invoice ref" value={t.invoiceReference ?? "—"} />
        </Subcard>

        <Subcard title="Categorization">
          <Row label="L1 Partition" value={t.partition.code} />
          <Row label="L2 Category" value={t.category.code} />
          <Row label="L3 Sub-item" value={t.subItem?.code ?? "(none)"} />
          <Row
            label="Dashboard visible"
            value={t.showOnDashboard ? "yes" : "no"}
          />
        </Subcard>
      </div>

      <p className="text-foreground/40 mt-4 text-[10px]">
        Created by {t.createdBy?.fullName ?? "(unknown)"} ·{" "}
        {new Date(t.createdAt).toLocaleString()} · Updated{" "}
        {new Date(t.updatedAt).toLocaleString()}
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: TransactionDetailSnapshot["status"] }) {
  const cls = statusClassFor(status);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
        cls,
      )}
    >
      {status}
    </span>
  );
}

function statusClassFor(status: TransactionDetailSnapshot["status"]): string {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "FLAGGED":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "VOIDED":
    case "ANULADO":
      return "bg-red-50 text-red-900 ring-red-200";
    case "PENDING":
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-foreground mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Subcard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-foreground/10 bg-background/50 rounded-xl border p-4">
      <h3 className="text-foreground/60 text-[10px] font-medium tracking-wider uppercase">
        {title}
      </h3>
      <dl className="mt-3 space-y-1.5 text-xs">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-foreground/50">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          accent ? "text-foreground font-semibold" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function prettyKind(kind: TransactionDetailSnapshot["kind"]): string {
  return kind
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function prettySource(source: TransactionDetailSnapshot["source"]): string {
  switch (source) {
    case "XLSX_IMPORT":
      return "xlsx import";
    case "BANK_STATEMENT":
      return "Bank statement";
    case "CHECK":
      return "Check";
    case "INVOICE":
      return "Invoice";
    case "MANUAL":
      return "Manual entry";
  }
}
