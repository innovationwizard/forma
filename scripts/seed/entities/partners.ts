/**
 * Partner seeder — upserts every Counterparty discovered by the parser.
 *
 * Per Batch 4.5 + Detalle egresos finding #5: the Partner entity carries
 * BOTH legal `type` (COMPANY/INDIVIDUAL/GOVERNMENT) and functional
 * `category` (VENDOR/TAX_AUTHORITY/BANK_AS_COUNTERPARTY/INTERNAL_ENTITY/
 * INTERNAL_INDIVIDUAL). Both axes seeded from the parser output.
 *
 * Idempotent via `name` lookup (no unique constraint in schema — same name
 * across runs resolves to the same row). Returns a Map<name, partnerId>
 * for downstream Expenditure + PartnerContribution FK resolution.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export interface PartnerIndex {
  byName: Map<string, string>;
  created: number;
  updated: number;
}

export async function seedPartners(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<PartnerIndex> {
  const byName = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const cp of bundle.counterparties) {
    const data = {
      name: cp.name,
      taxId: cp.taxId,
      type: cp.type,
      category: cp.category,
      isVendor: cp.isVendor,
      isBuyer: cp.isBuyer,
      notes: cp.notes,
    };

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.partner.findFirst({
        where: { name: cp.name, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.partner.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "Partner", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return { id: u.id, wasCreated: false };
      }
      const c = await tx.partner.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "Partner", entityId: c.id },
        importStamp,
      );
      return { id: c.id, wasCreated: true };
    });

    byName.set(cp.name, result.id);
    if (result.wasCreated) created++;
    else updated++;
  }

  return { byName, created, updated };
}
