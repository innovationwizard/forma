/**
 * Import-detail composite query — Batch 13a.
 *
 * Loads everything the `/import/[id]` page renders: import header + all
 * sheets + per-sheet row counts + DataQualityFlags raised during ingest.
 * Single parallel fan-out.
 */

import type { PrismaClient } from "@prisma/client";

export interface ImportDetailSnapshot {
  importId: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  uploadedAt: string;
  detectedBank: string;
  uploadedBy: { id: string; fullName: string } | null;
  sheets: Array<{
    id: string;
    sheetName: string;
    sheetIndex: number;
    rowCount: number;
    parseStatus: string;
    parseNote: string | null;
    statementType: string;
    detectedCurrency: string | null;
    detectedPeriodStart: string | null;
    detectedPeriodEnd: string | null;
    detectedAccount: { id: string; displayName: string; accountNumber: string } | null;
    isCanonical: boolean;
    alternatesLinkId: string | null;
    rawRowsCount: number;
    silverRowsCount: number;
  }>;
  flags: Array<{
    id: string;
    kind: string;
    severity: string;
    humanMessage: string;
    sourceWorkbookRef: string;
    raisedAt: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
  }>;
  totals: {
    rawRows: number;
    silverRows: number;
    duplicatesFlagged: number;
    parserWarnings: number;
  };
}

export async function loadImportDetail(
  prisma: PrismaClient,
  id: string,
): Promise<ImportDetailSnapshot | null> {
  const importRow = await prisma.bankStatementImport.findFirst({
    where: { id, deletedAt: null },
    include: {
      uploadedBy: { select: { id: true, fullName: true } },
      sheets: {
        orderBy: { sheetIndex: "asc" },
        include: {
          detectedBankAccount: {
            select: { id: true, displayName: true, accountNumber: true },
          },
          _count: {
            select: {
              rawRows: true,
            },
          },
        },
      },
    },
  });
  if (importRow == null) return null;

  // Silver counts per sheet — need to count BankTransaction by bronzeRowId →
  // sheet. Cleaner to scope by sheet's bronze rows.
  const silverCountsBySheet = new Map<string, number>();
  for (const sheet of importRow.sheets) {
    const c = await prisma.bankTransaction.count({
      where: { bronzeRow: { sheetId: sheet.id }, deletedAt: null },
    });
    silverCountsBySheet.set(sheet.id, c);
  }

  // Flags raised by this import: scoped to BankStatementSheet rows
  // belonging to this import (matches the ingest.ts emission pattern).
  const sheetIds = importRow.sheets.map((s) => s.id);
  const flags = await prisma.dataQualityFlag.findMany({
    where: {
      OR: [
        { relatedEntityType: "BankStatementSheet", relatedEntityId: { in: sheetIds } },
        // DUPLICATE_OF_PRIOR_IMPORT flags are related to raw rows; pick those
        // up by joining via the rawRows table's sheet membership.
        {
          relatedEntityType: "BankStatementRawRow",
          relatedEntityId: {
            in: (
              await prisma.bankStatementRawRow.findMany({
                where: { sheetId: { in: sheetIds } },
                select: { id: true },
              })
            ).map((r) => r.id),
          },
        },
      ],
    },
    orderBy: { raisedAt: "desc" },
  });

  const duplicatesFlagged = flags.filter((f) => f.kind === "DUPLICATE_OF_PRIOR_IMPORT").length;
  const parserWarnings = flags.filter((f) => f.kind === "BANK_PARSER_WARNING").length;
  const rawRowsTotal = importRow.sheets.reduce((acc, s) => acc + s._count.rawRows, 0);
  const silverRowsTotal = importRow.sheets.reduce(
    (acc, s) => acc + (silverCountsBySheet.get(s.id) ?? 0),
    0,
  );

  return {
    importId: importRow.id,
    fileName: importRow.fileName,
    fileSizeBytes: importRow.fileSizeBytes,
    fileSha256: importRow.fileSha256,
    uploadedAt: importRow.uploadedAt.toISOString(),
    detectedBank: importRow.detectedBank,
    uploadedBy: importRow.uploadedBy,
    sheets: importRow.sheets.map((s) => ({
      id: s.id,
      sheetName: s.sheetName,
      sheetIndex: s.sheetIndex,
      rowCount: s.rowCount,
      parseStatus: s.parseStatus,
      parseNote: s.parseNote,
      statementType: s.statementType,
      detectedCurrency: s.detectedCurrency,
      detectedPeriodStart: s.detectedPeriodStart?.toISOString().slice(0, 10) ?? null,
      detectedPeriodEnd: s.detectedPeriodEnd?.toISOString().slice(0, 10) ?? null,
      detectedAccount: s.detectedBankAccount,
      isCanonical: s.isCanonical,
      alternatesLinkId: s.alternatesLinkId,
      rawRowsCount: s._count.rawRows,
      silverRowsCount: silverCountsBySheet.get(s.id) ?? 0,
    })),
    flags: flags.map((f) => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      humanMessage: f.humanMessage,
      sourceWorkbookRef: f.sourceWorkbookRef,
      raisedAt: f.raisedAt.toISOString(),
      relatedEntityType: f.relatedEntityType,
      relatedEntityId: f.relatedEntityId,
    })),
    totals: {
      rawRows: rawRowsTotal,
      silverRows: silverRowsTotal,
      duplicatesFlagged,
      parserWarnings,
    },
  };
}
