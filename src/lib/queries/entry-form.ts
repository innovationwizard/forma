/**
 * Choice-list loader for the manual transaction entry form.
 *
 * Returns the partitions / categories / sub-items / partners / bank accounts
 * that the form's dropdowns + autosuggest need, in a single round-trip
 * (parallel fan-out). Pure data — no auth here; the page does auth.
 */

import type { PrismaClient } from "@prisma/client";

import { decimalString } from "../calc/currency";

export interface EntryFormChoices {
  ivaRate: string; // project's IVA rate as decimal string (e.g. "0.12")
  partitions: Array<{ id: string; code: string; name: string; sortOrder: number }>;
  categories: Array<{
    id: string;
    partitionId: string;
    code: string;
    name: string;
    sortOrder: number;
    dashboardVisible: boolean;
  }>;
  subItems: Array<{
    id: string;
    categoryId: string;
    code: string;
    description: string;
  }>;
  bankAccounts: Array<{
    id: string;
    displayName: string;
    accountNumber: string;
    currency: "GTQ" | "USD";
  }>;
  /// Partner names for the vendor autosuggest. Capped at ~200 so the
  /// datalist doesn't bloat the HTML; the seeded data is 40 partners so
  /// this is loose-fit, not a hard cap.
  partnerSuggestions: Array<{ id: string; name: string }>;
  /// Recent free-text vendorRaw values not already covered by partners —
  /// useful when the analyst is logging a transaction for a vendor that's
  /// in past data but not yet a formal Partner row.
  vendorHistory: string[];
}

export async function loadEntryFormChoices(prisma: PrismaClient): Promise<EntryFormChoices> {
  const [project, partitions, categories, subItems, bankAccounts, partners, recentVendors] =
    await Promise.all([
      prisma.project.findFirstOrThrow({
        where: { deletedAt: null },
        select: { ivaRate: true },
      }),
      prisma.budgetExecutionPartition.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.budgetCategory.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          partitionId: true,
          code: true,
          name: true,
          sortOrder: true,
          dashboardVisible: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.budgetSubItem.findMany({
        where: { deletedAt: null },
        select: { id: true, categoryId: true, code: true, description: true },
        orderBy: { code: "asc" },
      }),
      prisma.bankAccount.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, displayName: true, accountNumber: true, currency: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.partner.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      // Recent unique vendorRaw values from manual / xlsx expenditures.
      prisma.expenditure.findMany({
        where: { deletedAt: null },
        select: { vendorRaw: true },
        orderBy: { date: "desc" },
        distinct: ["vendorRaw"],
        take: 200,
      }),
    ]);

  const partnerNames = new Set(partners.map((p) => p.name));
  const vendorHistory = Array.from(
    new Set(recentVendors.map((e) => e.vendorRaw).filter((v) => !partnerNames.has(v))),
  );

  return {
    ivaRate: decimalString(project.ivaRate),
    partitions,
    categories,
    subItems,
    bankAccounts,
    partnerSuggestions: partners,
    vendorHistory,
  };
}
