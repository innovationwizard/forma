/**
 * BankAccount seeder. Idempotent upsert by accountNumber (unique). 9 rows
 * for Santa Elena per Detalle egresos finding #2 (6 active + 3 legacy).
 *
 * Returns a Map<displayName, accountId> for downstream Expenditure FK
 * resolution.
 *
 * **Caveat (per finding #2):** multiple bank accounts can share the same
 * `displayName` (e.g., 3 different G&T QTZ accounts). The map keys by
 * displayName only, so Expenditure FK resolution must match by displayName
 * AND date range (legacy vs active). For Santa Elena's current dataset,
 * each `displayName` resolves to one ACTIVE account, and Expenditure rows
 * disambiguate via the actual transaction record's account number — but
 * the parser bundle only carries displayName. The seed accepts this lossy
 * mapping and falls back to "first match" with isActive=true preference.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export interface BankAccountIndex {
  /// Maps displayName → preferred account id (the active one if multiple
  /// share the display string).
  byDisplayName: Map<string, string>;
  /// Maps (displayName, accountNumber) → account id for exact disambiguation.
  byDisplayAndNumber: Map<string, string>;
  created: number;
  updated: number;
}

export async function seedBankAccounts(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<BankAccountIndex> {
  const byDisplayName = new Map<string, string>();
  const byDisplayAndNumber = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const ba of bundle.bankAccounts) {
    const data = {
      bankName: ba.bankName,
      accountNumber: ba.accountNumber,
      currency: ba.currency,
      displayName: ba.displayName,
      isActive: ba.isActive,
    };

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.bankAccount.findUnique({
        where: { accountNumber: ba.accountNumber },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.bankAccount.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "BankAccount", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return { id: u.id, wasCreated: false };
      }
      const c = await tx.bankAccount.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "BankAccount", entityId: c.id },
        importStamp,
      );
      return { id: c.id, wasCreated: true };
    });

    if (result.wasCreated) created++;
    else updated++;

    byDisplayAndNumber.set(`${ba.displayName}|${ba.accountNumber}`, result.id);

    // For the displayName-only lookup, prefer the active account.
    const existingDisplayId = byDisplayName.get(ba.displayName);
    if (!existingDisplayId || ba.isActive) {
      byDisplayName.set(ba.displayName, result.id);
    }
  }

  return { byDisplayName, byDisplayAndNumber, created, updated };
}
