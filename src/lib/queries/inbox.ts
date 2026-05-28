/**
 * Inbox composite queries — Batch 13b.
 *
 * `loadInbox()` returns the UNCLASSIFIED `BankTransaction` rows for the
 * classification queue at `/inbox`. Sorted by `transactionDate DESC` so the
 * newest unclassified rows surface first (matches Ronny's xlsx workflow:
 * she works from most-recent statement backwards).
 *
 * `loadInboxItem(id)` returns one row's full detail + the choice lists
 * (RvUnits for inflow classification + budget categories for outflow).
 */

import type { PrismaClient } from "@prisma/client";

import { decimalString } from "../calc/currency";
import { loadEntryFormChoices, type EntryFormChoices } from "./entry-form";

export interface InboxRow {
  id: string;
  transactionDate: string;
  amountSigned: string;
  amountAbsUsdEstimate: string; // computed for display
  currency: "GTQ" | "USD";
  reference: string | null;
  description: string;
  agencia: string | null;
  direction: "DEBIT" | "CREDIT";
  bankAccount: { id: string; displayName: string; accountNumber: string };
  importFileName: string;
  sheetName: string;
}

export interface InboxSummary {
  unclassifiedCount: number;
  rows: InboxRow[];
}

export async function loadInbox(prisma: PrismaClient): Promise<InboxSummary> {
  const [rows, project] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { classificationStatus: "UNCLASSIFIED", deletedAt: null },
      orderBy: { transactionDate: "desc" },
      take: 500, // hard cap; pagination is Batch 17 work if it actually matters
      include: {
        bankAccount: {
          select: { id: true, displayName: true, accountNumber: true },
        },
        bronzeRow: {
          select: {
            sheet: {
              select: {
                sheetName: true,
                import: { select: { fileName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { lockedExchangeRate: true },
    }),
  ]);

  const lockedTc = Number(decimalString(project.lockedExchangeRate));

  return {
    unclassifiedCount: rows.length,
    rows: rows.map((r) => {
      const signed = Number(decimalString(r.amountSigned));
      const usd =
        r.currency === "USD"
          ? Math.abs(signed).toFixed(2)
          : lockedTc > 0
            ? (Math.abs(signed) / lockedTc).toFixed(2)
            : "0.00";
      return {
        id: r.id,
        transactionDate: r.transactionDate.toISOString().slice(0, 10),
        amountSigned: decimalString(r.amountSigned),
        amountAbsUsdEstimate: usd,
        currency: r.currency,
        reference: r.reference,
        description: r.description,
        agencia: r.agencia,
        direction: r.direction,
        bankAccount: r.bankAccount,
        importFileName: r.bronzeRow.sheet.import.fileName,
        sheetName: r.bronzeRow.sheet.sheetName,
      };
    }),
  };
}

// ── Per-row detail ────────────────────────────────────────────────────────

export interface InboxItemSnapshot {
  transaction: {
    id: string;
    transactionDate: string;
    amountSigned: string;
    amountAbsUsd: string;
    currency: "GTQ" | "USD";
    reference: string | null;
    description: string;
    agencia: string | null;
    direction: "DEBIT" | "CREDIT";
    saldoAfter: string | null;
    classificationStatus: string;
    classifierNote: string | null;
    bankAccount: { id: string; displayName: string; accountNumber: string };
    importFileName: string;
    sheetName: string;
    sourceRowNumber: number;
  };
  rvUnits: Array<{
    id: string;
    name: string;
    status: string;
    buyer: { id: string; name: string } | null;
  }>;
  expenditureChoices: EntryFormChoices;
  /// Project locked TC — used when reconstructing USD for inflow
  /// classification of GTQ-account payments.
  lockedExchangeRate: string;
}

export async function loadInboxItem(
  prisma: PrismaClient,
  id: string,
): Promise<InboxItemSnapshot | null> {
  const [tx, rvUnits, expenditureChoices, project] = await Promise.all([
    prisma.bankTransaction.findFirst({
      where: { id, deletedAt: null },
      include: {
        bankAccount: { select: { id: true, displayName: true, accountNumber: true } },
        bronzeRow: {
          select: {
            sourceRowNumber: true,
            sheet: {
              select: {
                sheetName: true,
                import: { select: { fileName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.rvUnit.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        buyer: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    loadEntryFormChoices(prisma),
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { lockedExchangeRate: true },
    }),
  ]);
  if (tx == null) return null;

  const lockedTc = Number(decimalString(project.lockedExchangeRate));
  const signed = Number(decimalString(tx.amountSigned));
  const usd =
    tx.currency === "USD"
      ? Math.abs(signed).toFixed(2)
      : lockedTc > 0
        ? (Math.abs(signed) / lockedTc).toFixed(2)
        : "0.00";

  return {
    transaction: {
      id: tx.id,
      transactionDate: tx.transactionDate.toISOString().slice(0, 10),
      amountSigned: decimalString(tx.amountSigned),
      amountAbsUsd: usd,
      currency: tx.currency,
      reference: tx.reference,
      description: tx.description,
      agencia: tx.agencia,
      direction: tx.direction,
      saldoAfter: tx.saldoAfter != null ? decimalString(tx.saldoAfter) : null,
      classificationStatus: tx.classificationStatus,
      classifierNote: tx.classifierNote,
      bankAccount: tx.bankAccount,
      importFileName: tx.bronzeRow.sheet.import.fileName,
      sheetName: tx.bronzeRow.sheet.sheetName,
      sourceRowNumber: tx.bronzeRow.sourceRowNumber,
    },
    rvUnits,
    expenditureChoices,
    lockedExchangeRate: decimalString(project.lockedExchangeRate),
  };
}
