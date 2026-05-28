/**
 * Level 1 — Category detail page.
 *
 *   /category/{code}?sort=date_desc&status=VERIFIED&q=Forma
 *
 * Server component. URL search params drive sort/filter/search. `params`
 * and `searchParams` are both async per Next 16 — awaited before use.
 *
 * Composes:
 *   - CategoryHeader  (budget / spent / over-by / status)
 *   - CategoryTimeline (Recharts area+line, client component)
 *   - SubItemsList   (L3 PARTIDA INTERNA rows)
 *   - TransactionsTable (unified Expenditure + PartnerContribution)
 *
 * The transactions table is the L1 acceptance criterion: TERRENOS shows
 * its real events summing to the over-budget figure on L0.
 */

import { notFound } from "next/navigation";

import { CategoryHeader } from "@/components/category/Header";
import { SubItemsList } from "@/components/category/SubItemsList";
import { CategoryTimeline } from "@/components/category/Timeline";
import { TransactionsTable } from "@/components/category/TransactionsTable";
import { prisma } from "@/lib/db";
import { loadCategoryDetail, type SortKey } from "@/lib/queries/category-detail";

import type { ExpenditureStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_SORTS: ReadonlySet<SortKey> = new Set([
  "date_desc",
  "date_asc",
  "amount_desc",
  "amount_asc",
]);

const VALID_STATUSES: ReadonlySet<ExpenditureStatus> = new Set([
  "PENDING",
  "VERIFIED",
  "FLAGGED",
  "VOIDED",
  "ANULADO",
]);

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { code } = await params;
  const rawSearch = await searchParams;

  const sort = parseSort(rawSearch["sort"]);
  const statusFilter = parseStatus(rawSearch["status"]);
  const counterpartySearch = parseSearch(rawSearch["q"]);

  const snapshot = await loadCategoryDetail(
    prisma,
    decodeURIComponent(code),
    { sort, statusFilter, counterpartySearch },
  );
  if (snapshot == null) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <CategoryHeader category={snapshot.category} />

      <CategoryTimeline
        timeline={snapshot.timeline}
        currentMonth={snapshot.project.currentMonth}
      />

      <SubItemsList subItems={snapshot.subItems} />

      <TransactionsTable
        categoryCode={snapshot.category.code}
        events={snapshot.events}
        totalEventCount={snapshot.totalEventCount}
        activeSort={sort}
        activeStatus={statusFilter ?? "ALL"}
        activeSearch={counterpartySearch ?? ""}
      />
    </main>
  );
}

function parseSort(value: string | string[] | undefined): SortKey {
  const v = Array.isArray(value) ? value[0] : value;
  if (v != null && VALID_SORTS.has(v as SortKey)) return v as SortKey;
  return "date_desc";
}

function parseStatus(value: string | string[] | undefined): ExpenditureStatus | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (v != null && VALID_STATUSES.has(v as ExpenditureStatus)) return v as ExpenditureStatus;
  return null;
}

function parseSearch(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
