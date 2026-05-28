/**
 * IsrObligation seeder per D34 — both `ISR 18` and `ISR 25` literal labels.
 *
 * Idempotent by `(projectId, uiLabel)` unique constraint. Two rows for
 * Santa Elena (the literal labels above).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export async function seedIsrObligations(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  projectId: string,
  userId: string,
  importStamp: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const o of bundle.isrObligations) {
    const data = {
      projectId,
      uiLabel: o.uiLabel,
      rate: o.rate,
      rateKind: o.rateKind,
      sourceCell: o.sourceCell,
      sourceTextVerbatim: o.sourceTextVerbatim,
      paymentPattern: o.paymentPattern,
      notes: o.notes,
      isActive: true,
    };
    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.isrObligation.findUnique({
        where: { projectId_uiLabel: { projectId, uiLabel: o.uiLabel } },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.isrObligation.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "IsrObligation", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.isrObligation.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "IsrObligation", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) created++;
    else updated++;
  }
  return { created, updated };
}
