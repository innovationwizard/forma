/**
 * CreditFacility + AmortizationRule seeder per D33 + N1.
 *
 * Santa Elena seeds 1 CreditFacility (BANK_DEVELOPMENT_LOAN with G&T) + 1
 * AmortizationRule (REVOLVENTE_HIBRIDO per author's note 2). Idempotent by
 * (lenderName, facilityType) on the facility; idempotent by
 * (facilityId, appliesFromMonth, mechanism) on the rule.
 *
 * The schema requires `initialCapUsd` + `currentCapUsd` + `ltvRatio` —
 * fields the parser fills from FCFCasas2 H56/H57/I59.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export interface CreditFacilityIndex {
  byRef: Map<string, string>;
  facilitiesCreated: number;
  facilitiesUpdated: number;
  rulesCreated: number;
  rulesUpdated: number;
}

export async function seedCreditFacilities(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<CreditFacilityIndex> {
  const byRef = new Map<string, string>();
  let facilitiesCreated = 0;
  let facilitiesUpdated = 0;
  let rulesCreated = 0;
  let rulesUpdated = 0;

  for (const f of bundle.creditFacilities) {
    const data = {
      lenderName: f.lenderName,
      facilityType: f.facilityType,
      mechanism: f.mechanism,
      initialCapUsd: f.initialCapUsd,
      currentCapUsd: f.currentCapUsd,
      annualRate: f.annualRate,
      ltvRatio: f.ltvRatio,
      ltcCeiling: f.ltcCeiling,
      isActive: true,
    };
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.creditFacility.findFirst({
        where: {
          lenderName: f.lenderName,
          facilityType: f.facilityType,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.creditFacility.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "CreditFacility", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return { id: u.id, wasCreated: false };
      }
      const c = await tx.creditFacility.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "CreditFacility", entityId: c.id },
        importStamp,
      );
      return { id: c.id, wasCreated: true };
    });
    byRef.set(f.ref, result.id);
    if (result.wasCreated) facilitiesCreated++;
    else facilitiesUpdated++;
  }

  for (const r of bundle.amortizationRules) {
    const facilityId = byRef.get(r.facilityRef);
    if (!facilityId) {
      throw new Error(
        `AmortizationRule references unknown facility ref '${r.facilityRef}'. Bundle malformed.`,
      );
    }
    const data = {
      facilityId,
      appliesFromMonth: r.appliesFromMonth,
      appliesToMonth: r.appliesToMonth,
      mechanism: r.mechanism,
      conditionsNote: r.conditionsNote,
    };
    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.amortizationRule.findFirst({
        where: {
          facilityId,
          appliesFromMonth: r.appliesFromMonth,
          mechanism: r.mechanism,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.amortizationRule.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "AmortizationRule", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.amortizationRule.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "AmortizationRule", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) rulesCreated++;
    else rulesUpdated++;
  }

  return { byRef, facilitiesCreated, facilitiesUpdated, rulesCreated, rulesUpdated };
}
