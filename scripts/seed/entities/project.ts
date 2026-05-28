/**
 * Project seeder. Idempotent upsert by `name` (singleton per D11 — exactly
 * one Project row for Santa Elena). Per D30 all metadata fields populated.
 *
 * Returns the seeded Project.id so downstream seeders can FK to it.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export async function seedProject(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<{ projectId: string; created: boolean }> {
  const p = bundle.project;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.project.findFirst({
      where: { name: p.name, deletedAt: null },
      select: { id: true },
    });

    const data = {
      name: p.name,
      legalEntityName: p.legalEntityName,
      company: p.company,
      location: p.location,
      address: p.address,
      currencyPrimary: p.currencyPrimary,
      currencySecondary: p.currencySecondary,
      lockedExchangeRate: p.lockedExchangeRate,
      tcBudgetaryLabel: p.tcBudgetaryLabel,
      tcEffectiveTerrenoHistorical: p.tcEffectiveTerrenoHistorical,
      ivaRate: p.ivaRate,
      startDate: new Date(p.startDate),
      projectedEndDate: new Date(p.projectedEndDate),
      internalApprovalDate: p.internalApprovalDate ? new Date(p.internalApprovalDate) : null,
      regulatoryHistoryNote: p.regulatoryHistoryNote,
      modelAuthorName: p.modelAuthorName,
      modelRecentEditorName: p.modelRecentEditorName,
      legalRepresentativeName: p.legalRepresentativeName,
      originalLandowner: p.originalLandowner,
      modelNotes: p.modelNotes,
    };

    if (existing) {
      const updated = await tx.project.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "Project", entityId: updated.id, fieldName: "(re-seed)" },
        importStamp,
      );
      return { projectId: updated.id, created: false };
    }

    const created = await tx.project.create({ data, select: { id: true } });
    await writeImportAuditLog(
      tx,
      { userId, entityType: "Project", entityId: created.id },
      importStamp,
    );
    return { projectId: created.id, created: true };
  });
}
