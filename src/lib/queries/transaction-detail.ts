/**
 * Level 2 — Transaction detail composite query.
 *
 * Loads ONE Expenditure (full field set including FK rollouts: bank, partner,
 * category, partition, subItem, createdBy) plus its full audit history.
 * Single round-trip from the caller's perspective; internally parallel.
 *
 * Returns `null` when the id doesn't match a non-soft-deleted Expenditure —
 * the page calls `notFound()`. Soft-deleted rows are intentionally invisible
 * here per D21 (they're recoverable via direct DB access in an incident,
 * not via the app UI).
 */

import type { ExpenditureStatus, PrismaClient } from "@prisma/client";

import { decimalString } from "../calc/currency";

export interface TransactionDetailSnapshot {
  id: string;
  date: string;
  vendorRaw: string;
  partner: { id: string; name: string } | null;
  bankAccount: {
    id: string;
    displayName: string;
    accountNumber: string;
    currency: "GTQ" | "USD";
  } | null;
  amounts: {
    conIvaGtq: string;
    sinIvaGtq: string;
    ivaGtq: string;
    /// Reconstructed USD (`amountUsd` column). Per Batch 7.5 this is the
    /// canonical USD value for budget-health rollups.
    usd: string;
  };
  exchangeRate: {
    /// `exchange_rate` column: 1.0 historically for USD-account rows;
    /// per-tx GTQ→USD for GTQ-account rows when extractable.
    bookedTc: string;
    /// `exchange_rate_at_transaction` column: per-tx TC from Descripción
    /// regex (Detalle egresos finding #11). `null` when not extractable.
    perTxTc: string | null;
    /// Project locked TC (the fallback when per-tx is null).
    lockedTc: string;
  };
  description: string;
  descriptionNormalized: string | null;
  kind: "OPERATING_EXPENSE" | "CASH_MOVEMENT" | "EQUITY_EVENT";
  category: { id: string; code: string; name: string };
  partition: { id: string; code: string; name: string };
  subItem: { id: string; code: string; description: string } | null;
  status: ExpenditureStatus;
  source: "BANK_STATEMENT" | "CHECK" | "INVOICE" | "MANUAL" | "XLSX_IMPORT";
  checkNumber: string | null;
  invoiceReference: string | null;
  sourceWorkbookRef: string | null;
  showOnDashboard: boolean;
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
  /// Reverse-chronological audit history scoped to this Expenditure id.
  audit: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VOID" | "IMPORT";
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  context: string | null;
  user: { id: string; fullName: string } | null;
}

export async function loadTransactionDetail(
  prisma: PrismaClient,
  id: string,
): Promise<TransactionDetailSnapshot | null> {
  const [expenditure, project, audit] = await Promise.all([
    prisma.expenditure.findFirst({
      where: { id, deletedAt: null },
      include: {
        partner: { select: { id: true, name: true } },
        bankAccount: {
          select: {
            id: true,
            displayName: true,
            accountNumber: true,
            currency: true,
          },
        },
        category: { select: { id: true, code: true, name: true } },
        partition: { select: { id: true, code: true, name: true } },
        subItem: { select: { id: true, code: true, description: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { lockedExchangeRate: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Expenditure", entityId: id },
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  if (expenditure == null) return null;

  return {
    id: expenditure.id,
    date: toIso(expenditure.date),
    vendorRaw: expenditure.vendorRaw,
    partner: expenditure.partner,
    bankAccount: expenditure.bankAccount,
    amounts: {
      conIvaGtq: decimalString(expenditure.amountConIva),
      sinIvaGtq: decimalString(expenditure.amountSinIva),
      ivaGtq: decimalString(expenditure.ivaAmount),
      usd: decimalString(expenditure.amountUsd),
    },
    exchangeRate: {
      bookedTc: decimalString(expenditure.exchangeRate),
      perTxTc:
        expenditure.exchangeRateAtTransaction != null
          ? decimalString(expenditure.exchangeRateAtTransaction)
          : null,
      lockedTc: decimalString(project.lockedExchangeRate),
    },
    description: expenditure.description,
    descriptionNormalized: expenditure.descriptionNormalized,
    kind: expenditure.kind,
    category: expenditure.category,
    partition: expenditure.partition,
    subItem: expenditure.subItem,
    status: expenditure.status,
    source: expenditure.source,
    checkNumber: expenditure.checkNumber,
    invoiceReference: expenditure.invoiceReference,
    sourceWorkbookRef: expenditure.sourceWorkbookRef,
    showOnDashboard: expenditure.showOnDashboard,
    createdBy: expenditure.createdBy,
    createdAt: expenditure.createdAt.toISOString(),
    updatedAt: expenditure.updatedAt.toISOString(),
    audit: audit.map((a) => ({
      id: a.id,
      timestamp: a.timestamp.toISOString(),
      action: a.action,
      fieldName: a.fieldName,
      oldValue: a.oldValue,
      newValue: a.newValue,
      context: a.context,
      user: a.user,
    })),
  };
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
