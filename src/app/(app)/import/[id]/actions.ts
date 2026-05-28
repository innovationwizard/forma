"use server";

/**
 * Twin-sheet toggle + silver re-derivation — Batch 13a.
 *
 * `flipCanonicalAction({ sheetId })`:
 *   1. `requireRole()` + `can(role, "UPDATE", "bank_statement_sheet")`. The
 *      matrix grants this to ANALISTA only — flipping canonical re-derives
 *      silver, which is meaningful side effect, not junior territory.
 *   2. Loads the sheet + its alternate(s) within the same import.
 *   3. In one Prisma transaction:
 *      a. Soft-deletes all silver rows linked (via bronzeRow.sheet) to the
 *         current canonical sheet.
 *      b. Flips `is_canonical` flags so the requested sheet becomes canonical
 *         and its alternates link back to it.
 *      c. Re-promotes silver from the new canonical sheet's bronze rows
 *         using the SAME natural-key dedup as the original ingest path.
 *   4. Audit-logs the flip (action=UPDATE, fieldName=is_canonical).
 *
 * Per D31 + D21: bronze is NEVER modified or deleted. Only silver is
 * re-derived. The pre-flip silver rows are SOFT-deleted so we keep the
 * audit history of what the silver looked like before.
 *
 * Per Jorge directive #2: this is the UI toggle that picks which sheet's
 * data flows downstream.
 */

import { revalidatePath } from "next/cache";

import type { BankTransactionDirection } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

export type FlipResult =
  | { ok: true; flippedSheetId: string; silverInserted: number; silverSoftDeleted: number }
  | { ok: false; error: "forbidden" | "not_found" | "invalid" | "internal"; message: string };

export async function flipCanonicalAction(input: { sheetId: string }): Promise<FlipResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "bank_statement_sheet")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot flip canonical-sheet decisions.`,
    };
  }

  const sheet = await prisma.bankStatementSheet.findUnique({
    where: { id: input.sheetId },
    select: {
      id: true,
      importId: true,
      isCanonical: true,
      detectedBankAccountId: true,
      detectedCurrency: true,
      sheetName: true,
    },
  });
  if (sheet == null) {
    return { ok: false, error: "not_found", message: "Sheet not found." };
  }
  if (sheet.isCanonical) {
    return {
      ok: false,
      error: "invalid",
      message: "Sheet is already canonical — nothing to flip.",
    };
  }
  if (sheet.detectedBankAccountId == null || sheet.detectedCurrency == null) {
    return {
      ok: false,
      error: "invalid",
      message: "Sheet has no detected account/currency — silver can't be derived from it.",
    };
  }

  // Identify the OTHER sheets in the same (import, account, currency)
  // bucket — these are the current canonical + any other alternates.
  const peers = await prisma.bankStatementSheet.findMany({
    where: {
      importId: sheet.importId,
      detectedBankAccountId: sheet.detectedBankAccountId,
      detectedCurrency: sheet.detectedCurrency,
      id: { not: sheet.id },
    },
    select: { id: true, isCanonical: true },
  });
  const currentCanonical = peers.find((p) => p.isCanonical) ?? null;

  let silverSoftDeleted = 0;
  let silverInserted = 0;
  let importIdForRevalidate: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      importIdForRevalidate = sheet.importId;

      // (a) Soft-delete silver rows derived from the current canonical sheet.
      if (currentCanonical != null) {
        const result = await tx.bankTransaction.updateMany({
          where: {
            bronzeRow: { sheetId: currentCanonical.id },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        silverSoftDeleted = result.count;
      }

      // (b) Flip canonical flags.
      await tx.bankStatementSheet.update({
        where: { id: sheet.id },
        data: { isCanonical: true, alternatesLinkId: null },
      });
      // Mark old canonical + any other peers as non-canonical, link them to new canonical.
      for (const peer of peers) {
        await tx.bankStatementSheet.update({
          where: { id: peer.id },
          data: { isCanonical: false, alternatesLinkId: sheet.id },
        });
      }

      // (c) Re-promote silver from the new canonical sheet's bronze rows.
      silverInserted = await silverPromote(tx, sheet.id);

      // Audit-log the flip.
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BankStatementSheet",
          entityId: sheet.id,
          action: "UPDATE",
          fieldName: "is_canonical",
          oldValue: "false",
          newValue: "true",
          context: `Twin-sheet flip: silver re-derived (${silverSoftDeleted} soft-deleted, ${silverInserted} inserted).`,
        },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (importIdForRevalidate != null) {
    revalidatePath(`/import/${importIdForRevalidate}`);
  }
  return { ok: true, flippedSheetId: sheet.id, silverInserted, silverSoftDeleted };
}

/// Re-derive silver from a single sheet's bronze rows. Reads each
/// `BankStatementRawRow` where `parseStatus = OK`, reconstructs a
/// `SilverCandidate`-equivalent insert, and tries to write a
/// `BankTransaction`. Hits to the natural-key UNIQUE constraint become
/// DUPLICATE_OF_PRIOR_IMPORT flags instead of throwing.
///
/// The shape of the reconstruction here mirrors `ingest.ts` deliberately —
/// in a future refactor we'd extract the silver-promotion step into a pure
/// function that both the upload path and this flip path call.
async function silverPromote(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sheetId: string,
): Promise<number> {
  const sheet = await tx.bankStatementSheet.findUniqueOrThrow({
    where: { id: sheetId },
    select: {
      detectedBankAccountId: true,
      detectedCurrency: true,
      sheetName: true,
      importId: true,
    },
  });
  if (sheet.detectedBankAccountId == null || sheet.detectedCurrency == null) return 0;

  const okRows = await tx.bankStatementRawRow.findMany({
    where: { sheetId, parseStatus: "OK" },
    orderBy: { sourceRowNumber: "asc" },
  });

  let inserted = 0;
  for (const row of okRows) {
    // Reconstruct the silver candidate from rawCells. This is the same
    // shape gtAdapter.parse() produces (column-letter keys). For non-G&T
    // adapters this reconstruction would differ — when 13b lands we'll
    // route through the adapter's `reparse(rawCells)` helper. For 13a's
    // G&T-only scope, the shape is known.
    const cells = row.rawCells as Record<string, unknown>;
    const candidate = extractGtSilverFromCells(cells);
    if (candidate == null) continue;

    const naturalKey = `${sheet.detectedBankAccountId}|${candidate.transactionDate}|${candidate.reference ?? `descSha:${candidate.descSha}`}|${candidate.amountSigned}`;

    try {
      await tx.bankTransaction.create({
        data: {
          bankAccountId: sheet.detectedBankAccountId,
          transactionDate: new Date(`${candidate.transactionDate}T00:00:00Z`),
          amountSigned: candidate.amountSigned,
          currency: sheet.detectedCurrency,
          reference: candidate.reference,
          description: candidate.description,
          agencia: candidate.agencia,
          direction: candidate.direction as BankTransactionDirection,
          saldoAfter: candidate.saldoAfter,
          bronzeRowId: row.id,
          naturalKey,
        },
      });
      inserted += 1;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        await tx.dataQualityFlag.create({
          data: {
            kind: "DUPLICATE_OF_PRIOR_IMPORT",
            severity: "INFO",
            sourceWorkbookRef: `BankStatementImport:${sheet.importId}/Sheet:${sheet.sheetName}/Row:${row.sourceRowNumber}`,
            sourceValue: `naturalKey=${naturalKey}`,
            humanMessage:
              `Twin-sheet flip: re-derived silver candidate already exists from another source. ` +
              `Bronze row preserved per D31.`,
            relatedEntityType: "BankStatementRawRow",
            relatedEntityId: row.id,
          },
        });
      } else {
        throw err;
      }
    }
  }
  return inserted;
}

/// G&T-specific reconstruction from JSONB rawCells. Mirrors what the
/// adapter's parse() does. For 13b we'll route this through an adapter
/// `reparse(rawCells)` method to support multiple banks.
function extractGtSilverFromCells(
  cells: Record<string, unknown>,
): {
  transactionDate: string;
  amountSigned: string;
  reference: string | null;
  description: string;
  agencia: string | null;
  direction: "DEBIT" | "CREDIT";
  saldoAfter: string | null;
  descSha: string;
} | null {
  // Inline date parse — mirrors gtFechaToIso.
  const dateRaw = cells["B"];
  let isoDate: string | null = null;
  if (dateRaw instanceof Date) isoDate = dateRaw.toISOString().slice(0, 10);
  else if (typeof dateRaw === "string") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateRaw.trim());
    if (m != null) isoDate = `${m[3]}-${m[2]}-${m[1]}`;
    else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) isoDate = dateRaw.slice(0, 10);
  }
  if (isoDate == null) return null;

  // Inline signed-amount derivation — mirrors gtSignedAmount.
  const toNum = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const t = v.trim().replace(/,/g, "");
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const debit = toNum(cells["E"]);
  const credit = toNum(cells["F"]);
  const debitPresent = debit != null && debit !== 0;
  const creditPresent = credit != null && credit !== 0;
  if (debitPresent && creditPresent) return null;
  if (!debitPresent && !creditPresent) return null;
  let amount: number;
  if (debitPresent && debit != null) amount = debit < 0 ? debit : -debit;
  else if (creditPresent && credit != null) amount = credit;
  else return null;

  const description = typeof cells["D"] === "string" ? cells["D"].trim() : "";
  const reference = typeof cells["C"] === "string" && cells["C"].trim().length > 0 ? cells["C"].trim() : null;
  const agencia = typeof cells["H"] === "string" && cells["H"].trim().length > 0 ? cells["H"].trim() : null;
  const saldo = toNum(cells["G"]);

  // sha-prefix for description (used when reference is null).
  // Simple FNV-like hash, no need for crypto here — collision resistance
  // not security-critical, just dedup-uniqueness.
  let h = 2166136261;
  for (let i = 0; i < description.length; i++) {
    h = Math.imul(h ^ description.charCodeAt(i), 16777619);
  }
  const descSha = (h >>> 0).toString(16).padStart(8, "0");

  return {
    transactionDate: isoDate,
    amountSigned: amount.toFixed(2),
    reference,
    description,
    agencia,
    direction: amount < 0 ? "DEBIT" : "CREDIT",
    saldoAfter: saldo != null ? saldo.toFixed(2) : null,
    descSha,
  };
}
