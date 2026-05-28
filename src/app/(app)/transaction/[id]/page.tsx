/**
 * Level 2 — Transaction detail page.
 *
 *   /transaction/{id}
 *
 * Server component. Composes:
 *   - TransactionDetailCard (every Expenditure field)
 *   - StatusActions (flag / void; role-gated)
 *   - EditForm (vendor + description; role-gated)
 *   - AuditTimeline (entity-scoped history)
 *
 * Per Batch 11 acceptance: as Analyst, editing vendor name persists, surfaces
 * in the timeline, and is rejected for CEO (server-side via `can()` in the
 * server actions — RLS exists as defense-in-depth but the app's Prisma
 * connection bypasses it; the action's `can()` check is the authoritative
 * gate; see `actions.ts` for the honest disclosure).
 */

import { notFound } from "next/navigation";

import { AuditTimeline } from "@/components/transaction/AuditTimeline";
import { TransactionDetailCard } from "@/components/transaction/Detail";
import { EditForm } from "@/components/transaction/EditForm";
import { StatusActions } from "@/components/transaction/StatusActions";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadTransactionDetail } from "@/lib/queries/transaction-detail";
import { can } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { role } = await requireRole();
  const snapshot = await loadTransactionDetail(prisma, id);
  if (snapshot == null) notFound();

  const canMutate = can(role, "UPDATE", "expenditure");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <TransactionDetailCard transaction={snapshot} />

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Actions</h2>
        <p className="text-foreground/50 mt-1 text-xs">
          {canMutate
            ? `Available to your role (${role}).`
            : `View-only for your role (${role}). Server enforces this — buttons are hidden, but mutation requests would be rejected with 403.`}
        </p>
        <div className="mt-4">
          <StatusActions
            id={snapshot.id}
            currentStatus={snapshot.status}
            canMutate={canMutate}
          />
        </div>
      </section>

      <EditForm
        id={snapshot.id}
        initialVendorRaw={snapshot.vendorRaw}
        initialDescription={snapshot.description}
        canEdit={canMutate}
      />

      <AuditTimeline events={snapshot.audit} />
    </main>
  );
}
