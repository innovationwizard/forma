/**
 * Per-house sales detail — Batch 15.
 *
 *   /sales/[id]
 *
 * Buyer/lifecycle-focused view. Complements `/casa/[id]/reflujo` (the
 * flow-focused view from Batch 13c). Both routes are valid entry points
 * to the same unit; users navigate between them via header links.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { LinkBuyerForm } from "@/components/sales/LinkBuyerForm";
import { RecordPaymentForm } from "@/components/sales/RecordPaymentForm";
import { StatusActions } from "@/components/sales/StatusActions";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadEntryFormChoices } from "@/lib/queries/entry-form";
import { loadSalesDetail } from "@/lib/queries/sales";
import { can } from "@/lib/rbac/matrix";
import { formatIsoDate, formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SalesDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { role } = await requireRole();
  const [snapshot, choices] = await Promise.all([
    loadSalesDetail(prisma, id),
    loadEntryFormChoices(prisma),
  ]);
  if (snapshot == null) notFound();

  const canMutateUnits = can(role, "UPDATE", "rv_units");
  const canCreatePayment = can(role, "CREATE", "rv_payment");
  const u = snapshot.unit;
  const buyerLabel = u.buyer?.name ?? null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/sales"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Back to sales
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">{u.name}</h1>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-zinc-700 ring-1 ring-zinc-200 ring-inset uppercase">
              {u.status}
            </span>
          </div>
          <Link
            href={`/casa/${u.id}/reflujo`}
            className="text-foreground/60 hover:text-foreground text-xs underline"
          >
            View reflujo →
          </Link>
        </div>
        <p className="text-foreground/60 mt-1 text-sm">
          {buyerLabel ?? (
            <span className="italic">Buyer not linked yet.</span>
          )}
        </p>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Unit summary</h2>
        <dl className="text-foreground mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Area (m²)" value={u.areaM2} />
          <Stat
            label="Sale price"
            value={u.salePriceSinIvaUsd != null ? formatUsd(u.salePriceSinIvaUsd) : "—"}
          />
          <Stat label="Enganche rate" value={formatPct(u.engancheRate)} />
          <Stat label="Expected enganche" value={formatUsd(snapshot.totals.engancheExpectedUsd)} />
          <Stat label="Sale month" value={u.saleMonth != null ? `M${u.saleMonth}` : "—"} />
          <Stat label="Delivery month" value={u.deliveryMonth != null ? `M${u.deliveryMonth}` : "—"} />
          <Stat label="Reserved on" value={u.reservedAt != null ? formatIsoDate(u.reservedAt) : "—"} />
          <Stat label="Sold on" value={u.soldAt != null ? formatIsoDate(u.soldAt) : "—"} />
          <Stat label="Total planned" value={formatUsd(snapshot.totals.plannedUsd)} />
          <Stat label="Total paid" value={formatUsd(snapshot.totals.paidUsd)} />
        </dl>
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Buyer</h2>
        {u.buyer != null ? (
          <dl className="text-foreground mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <Stat label="Name" value={u.buyer.name} />
            <Stat label="Tax ID (NIT)" value={u.buyer.taxId ?? "—"} />
            <Stat label="Type" value={u.buyer.type.toLowerCase()} />
          </dl>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-foreground/60 text-xs">
              No buyer linked. {u.status === "SOLD" ? (
                <span className="text-amber-700">
                  ▲ Unit is SOLD — buyer data is incomplete. Link a partner below.
                </span>
              ) : (
                "Link a partner if a buyer is in negotiation."
              )}
            </p>
            <LinkBuyerForm
              unitId={u.id}
              partnerSuggestions={choices.partnerSuggestions}
              canMutate={canMutateUnits}
            />
          </div>
        )}
      </section>

      {canMutateUnits ? (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <h2 className="text-foreground text-base font-semibold">Status actions</h2>
          <p className="text-foreground/50 mt-1 text-xs">
            State-machine validated server-side. Allowed transitions from{" "}
            <strong>{u.status}</strong> only.
          </p>
          <div className="mt-3">
            <StatusActions id={u.id} currentStatus={u.status} canMutate={canMutateUnits} />
          </div>
        </section>
      ) : null}

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">
          Payments ({snapshot.payments.length})
        </h2>
        {snapshot.payments.length === 0 ? (
          <p className="text-foreground/60 mt-3 text-sm">
            No payments recorded yet. Classify bank inflows from the{" "}
            <Link href="/inbox" className="underline">
              Inbox
            </Link>{" "}
            to attribute them to this unit, or record a manual entry below.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="text-foreground/80 w-full text-sm">
              <thead>
                <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">USD</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">GTQ</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Reconciliation</th>
                  <th scope="col" className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {snapshot.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-foreground py-2 pr-3 tabular-nums">
                      {formatIsoDate(p.paymentDate)}
                    </td>
                    <td className="text-foreground py-2 pr-3 text-right tabular-nums">
                      {formatUsd(p.amountUsd)}
                    </td>
                    <td className="text-foreground/70 py-2 pr-3 text-right tabular-nums">
                      Q {p.amountGtq}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                          p.reconciliationStatus === "MATCHED"
                            ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                            : p.reconciliationStatus === "OVERPAYMENT"
                              ? "bg-sky-50 text-sky-900 ring-sky-200"
                              : p.reconciliationStatus === "UNDERPAYMENT"
                                ? "bg-amber-50 text-amber-900 ring-amber-200"
                                : "bg-zinc-100 text-zinc-700 ring-zinc-200",
                        )}
                      >
                        {p.reconciliationStatus}
                      </span>
                    </td>
                    <td className="text-foreground/60 py-2 text-xs">
                      {p.bankTransactionId != null ? (
                        <Link
                          href={`/inbox/${p.bankTransactionId}`}
                          className="underline"
                        >
                          bank tx
                        </Link>
                      ) : (
                        <span className="italic">manual</span>
                      )}
                      {p.notes != null ? (
                        <span className="text-foreground/40 ml-2">— {p.notes}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canCreatePayment ? (
          <details className="mt-5">
            <summary className="text-foreground/70 hover:text-foreground cursor-pointer text-xs">
              Record manual payment
            </summary>
            <div className="border-foreground/10 mt-3 border-t pt-4">
              <RecordPaymentForm
                unitId={u.id}
                lockedExchangeRate={"7.7"}
                canMutate={canCreatePayment}
              />
            </div>
          </details>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50 text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
