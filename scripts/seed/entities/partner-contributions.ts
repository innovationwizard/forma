/**
 * PartnerContribution seeder per D33. 2 rows for Santa Elena at minimum
 * (2018 IN_KIND_ASSET aportación + 2025 CASH_PURCHASE) — both foundational
 * terreno acquisition events.
 *
 * Per Batch 7.5:
 *   - USD reconstruction at seed time (parser emits amountUsd = "0";
 *     seed converts via the project's locked TC).
 *   - Resolves `categoryId` FK from the parser's `categoryCode` field so
 *     budget-health can roll PC amounts into the matching BudgetCategory's
 *     "spent" total. Both SE PCs → TERRENOS.
 *
 * Idempotent by `(projectId, partnerId, date, kind, sourceWorkbookRef)`.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { BudgetIndex } from "./budget";
import type { PartnerIndex } from "./partners";
import type { ValidatedParseBundle } from "../types";

export async function seedPartnerContributions(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  projectId: string,
  partners: PartnerIndex,
  budget: BudgetIndex,
  userId: string,
  importStamp: string,
): Promise<{ created: number; updated: number; skippedMissingPartner: number }> {
  let created = 0;
  let updated = 0;
  let skippedMissingPartner = 0;

  const lockedTc = Number(bundle.project.lockedExchangeRate);
  if (!Number.isFinite(lockedTc) || lockedTc === 0) {
    throw new Error(
      `PartnerContribution seeder: invalid project locked TC '${bundle.project.lockedExchangeRate}'.`,
    );
  }

  for (const pc of bundle.partnerContributions) {
    const partnerId = partners.byName.get(pc.partnerName);
    if (!partnerId) {
      skippedMissingPartner++;
      continue;
    }

    // Resolve categoryId from the parser's categoryCode (Batch 7.5).
    // The parser emits "TERRENOS" for both SE PCs (their source row's
    // partida = TERRENO). If categoryCode is unknown to the budget index,
    // leave as null and the calc layer's budget-health will exclude them
    // from any category total — no silent attribution.
    const categoryId = pc.categoryCode
      ? budget.categoriesByCode.get(pc.categoryCode) ?? null
      : null;

    // USD reconstruction (Batch 7.5). Parser emits "0" because it doesn't
    // know the project TC. Seed converts via project.lockedExchangeRate.
    // For Batch 7.5 we use the locked TC; future enhancement: use per-date
    // historical TC from BANGUAT for finer precision.
    const amountGtq = Number(pc.amountGtq);
    const amountUsd = Number.isFinite(amountGtq) ? (amountGtq / lockedTc).toFixed(2) : "0";

    const data = {
      projectId,
      partnerId,
      categoryId,
      date: new Date(pc.date),
      amountGtq: pc.amountGtq,
      amountUsd,
      kind: pc.kind,
      assetDescription: pc.assetDescription,
      sourceWorkbookRef: pc.sourceWorkbookRef,
      notes: pc.notes,
    };
    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.partnerContribution.findFirst({
        where: {
          projectId,
          partnerId,
          date: new Date(pc.date),
          kind: pc.kind,
          sourceWorkbookRef: pc.sourceWorkbookRef,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.partnerContribution.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "PartnerContribution", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.partnerContribution.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "PartnerContribution", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) created++;
    else updated++;
  }

  return { created, updated, skippedMissingPartner };
}
