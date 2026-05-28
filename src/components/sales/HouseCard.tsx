/**
 * House card for the `/sales` grid — Batch 15.
 *
 * Server-component-rendered. Click → `/sales/[id]` detail. Visual indicator
 * for "data incomplete" (sold houses without a linked buyer per Gate 15.1).
 */

import Link from "next/link";

import type { SalesGridRow } from "@/lib/queries/sales";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HouseCardProps {
  row: SalesGridRow;
}

const STATUS_STYLE: Record<
  SalesGridRow["status"],
  { label: string; pillClass: string; ringClass: string }
> = {
  SOLD: {
    label: "Sold",
    pillClass: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    ringClass: "ring-emerald-200/60",
  },
  RESERVED: {
    label: "Reserved",
    pillClass: "bg-sky-100 text-sky-900 ring-sky-200",
    ringClass: "ring-sky-200/60",
  },
  SOFT_HOLD: {
    label: "Soft hold",
    pillClass: "bg-amber-100 text-amber-900 ring-amber-200",
    ringClass: "ring-amber-200/60",
  },
  FROZEN: {
    label: "Frozen",
    pillClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    ringClass: "ring-zinc-200/60",
  },
  AVAILABLE: {
    label: "Available",
    pillClass: "bg-zinc-50 text-zinc-600 ring-zinc-200",
    ringClass: "ring-zinc-200/60",
  },
};

export function HouseCard({ row }: HouseCardProps) {
  const style = STATUS_STYLE[row.status];
  const paid = Number(row.totalPaidUsd);
  const planned = Number(row.salePriceSinIvaUsd ?? 0);
  const completion = planned > 0 ? paid / planned : 0;
  return (
    <Link
      href={`/sales/${row.id}`}
      className={cn(
        "border-foreground/10 bg-card text-card-foreground flex flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2",
        style.ringClass,
      )}
      aria-label={`Open sales detail for ${row.name}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{row.name}</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
            style.pillClass,
          )}
        >
          {style.label}
        </span>
      </div>

      <div className="text-foreground/70 text-xs">
        {row.buyer != null ? (
          <span className="text-foreground">{row.buyer.name}</span>
        ) : (
          <span className="text-foreground/40 italic">
            {row.status === "SOLD" ? "(buyer not linked — needs data)" : "no buyer yet"}
          </span>
        )}
      </div>

      <dl className="text-foreground/80 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-foreground/50">Price</dt>
        <dd className="text-foreground text-right tabular-nums">
          {row.salePriceSinIvaUsd != null ? formatUsd(row.salePriceSinIvaUsd) : "—"}
        </dd>
        <dt className="text-foreground/50">Paid to date</dt>
        <dd className="text-foreground text-right tabular-nums">{formatUsd(row.totalPaidUsd)}</dd>
        <dt className="text-foreground/50">Sale month</dt>
        <dd className="text-foreground text-right tabular-nums">
          {row.saleMonth != null ? `M${row.saleMonth}` : "—"}
        </dd>
        <dt className="text-foreground/50">Delivery month</dt>
        <dd className="text-foreground text-right tabular-nums">
          {row.deliveryMonth != null ? `M${row.deliveryMonth}` : "—"}
        </dd>
      </dl>

      {planned > 0 ? (
        <div className="text-foreground/60 flex items-center justify-between text-[10px] tabular-nums">
          <span>{formatPct(completion)} paid</span>
          {row.dataIncomplete ? (
            <span className="text-amber-700">▲ data incomplete</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
