/**
 * RvUnit + RvReservation seeder per D9 + D29.
 *
 * Sold bucket = {1, 2, 5, 6, 7, 11} per D29 operational override (Casa 5
 * + Casa 6 retain SOLD pending Q-CASA-5 / Q-CASA-6-STATUS resolution).
 *
 * Idempotent by RvUnit.name (unique). Reservations are seeded only if the
 * parser surfaces them — currently empty (parser doesn't pull from the
 * RESERVAS workbook in Batch 5; future batch).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { PartnerIndex } from "./partners";
import type { ValidatedParseBundle } from "../types";

export interface RvUnitIndex {
  unitsByName: Map<string, string>;
  reservationsCreated: number;
  unitsCreated: number;
  unitsUpdated: number;
}

export async function seedRvUnits(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  partners: PartnerIndex,
  userId: string,
  importStamp: string,
): Promise<RvUnitIndex> {
  const unitsByName = new Map<string, string>();
  let unitsCreated = 0;
  let unitsUpdated = 0;
  let reservationsCreated = 0;

  for (const u of bundle.rvUnits) {
    const buyerId = u.buyerName ? partners.byName.get(u.buyerName) ?? null : null;
    const data = {
      name: u.name,
      type: u.type,
      areaM2: u.areaM2,
      pricePerM2Usd: u.pricePerM2Usd,
      salePriceSinIvaUsd: u.salePriceSinIvaUsd,
      engancheRate: u.engancheRate,
      status: u.status,
      buyerId,
      saleMonth: u.saleMonth,
      deliveryMonth: u.deliveryMonth,
      reservedAt: u.reservedAt ? new Date(u.reservedAt) : null,
      soldAt: u.soldAt ? new Date(u.soldAt) : null,
    };
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.rvUnit.findUnique({
        where: { name: u.name },
        select: { id: true },
      });
      if (existing) {
        const upd = await tx.rvUnit.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "RvUnit", entityId: upd.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return { id: upd.id, wasCreated: false };
      }
      const created = await tx.rvUnit.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "RvUnit", entityId: created.id },
        importStamp,
      );
      return { id: created.id, wasCreated: true };
    });
    unitsByName.set(u.name, result.id);
    if (result.wasCreated) unitsCreated++;
    else unitsUpdated++;
  }

  // Reservations (parser-extracted) — empty in Batch 5 output. The loop
  // is present so future enhancements (e.g., RESERVAS workbook ingestion)
  // wire up without re-architecting.
  for (const r of bundle.rvReservations) {
    const unitId = unitsByName.get(r.unitName);
    const partnerId = partners.byName.get(r.partnerName);
    if (!unitId || !partnerId) continue;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const exists = await tx.rvReservation.findFirst({
        where: { unitId, partnerId, reservedAt: new Date(r.reservedAt), deletedAt: null },
        select: { id: true },
      });
      if (exists) return;
      const created = await tx.rvReservation.create({
        data: {
          unitId,
          partnerId,
          status: r.status,
          reservedAt: new Date(r.reservedAt),
          decidedAt: r.decidedAt ? new Date(r.decidedAt) : null,
          notes: r.notes,
          createdByUserId: userId,
        },
        select: { id: true },
      });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "RvReservation", entityId: created.id },
        importStamp,
      );
      reservationsCreated++;
    });
  }

  return { unitsByName, reservationsCreated, unitsCreated, unitsUpdated };
}
