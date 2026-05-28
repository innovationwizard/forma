/**
 * Budget hierarchy seeder per N4 (3 levels):
 *   L1 — BudgetExecutionPartition (PARTIDA EJECUCIÓN PRESUPUESTARIA)
 *   L2 — BudgetCategory             (PARTIDA GENERAL)
 *   L3 — BudgetSubItem              (PARTIDA INTERNA)
 *
 * Idempotent: L1/L2 unique by `code`, L3 unique by `(category_id, code)`.
 * Order: partition → category → sub-item, FK-resolved at insert time.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

export interface BudgetIndex {
  partitionsByCode: Map<string, string>;
  categoriesByCode: Map<string, string>;
  subItemsByCategoryAndCode: Map<string, string>;
  counts: { partitions: number; categories: number; subItems: number };
}

export async function seedBudget(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<BudgetIndex> {
  const partitionsByCode = new Map<string, string>();
  const categoriesByCode = new Map<string, string>();
  const subItemsByCategoryAndCode = new Map<string, string>();

  // L1 — BudgetExecutionPartition
  for (const p of bundle.budgetExecutionPartitions) {
    const id = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ex = await tx.budgetExecutionPartition.findUnique({
        where: { code: p.code },
        select: { id: true },
      });
      if (ex) {
        const u = await tx.budgetExecutionPartition.update({
          where: { id: ex.id },
          data: { name: p.name, sortOrder: p.sortOrder },
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "BudgetExecutionPartition", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return u.id;
      }
      const c = await tx.budgetExecutionPartition.create({
        data: { code: p.code, name: p.name, sortOrder: p.sortOrder },
        select: { id: true },
      });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "BudgetExecutionPartition", entityId: c.id },
        importStamp,
      );
      return c.id;
    });
    partitionsByCode.set(p.code, id);
  }

  // L2 — BudgetCategory
  for (const c of bundle.budgetCategories) {
    const partitionId = partitionsByCode.get(c.partitionCode);
    if (!partitionId) {
      throw new Error(
        `BudgetCategory '${c.code}' references unknown partition '${c.partitionCode}'. Seed bundle is malformed.`,
      );
    }
    const data = {
      partitionId,
      code: c.code,
      name: c.name,
      budgetAmountUsd: c.budgetAmountUsd,
      budgetPercentage: c.budgetPercentage,
      commissionRate: c.commissionRate,
      dashboardVisible: c.dashboardVisible,
      sortOrder: c.sortOrder,
    };
    const id = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ex = await tx.budgetCategory.findUnique({
        where: { code: c.code },
        select: { id: true },
      });
      if (ex) {
        const u = await tx.budgetCategory.update({
          where: { id: ex.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "BudgetCategory", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return u.id;
      }
      const created = await tx.budgetCategory.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "BudgetCategory", entityId: created.id },
        importStamp,
      );
      return created.id;
    });
    categoriesByCode.set(c.code, id);
  }

  // ── System categories (Batch 7.5 additions) ──────────────────────────────
  // Two categories that don't come from FCFCasas2 dashboard but are needed
  // for the seed's partida-mapping completeness. Both dashboardVisible=false
  // per SDD §2.1 (anomaly detector hides predictable spending).
  type SystemCategory = (typeof bundle.budgetCategories)[number];
  const systemCategories: SystemCategory[] = [
    {
      partitionCode: "SANTA_ELENA_OPERATING",
      code: "IMPUESTOS",
      name: "IMPUESTOS",
      budgetAmountUsd: "0",
      budgetPercentage: "0",
      commissionRate: null,
      dashboardVisible: false,
      sortOrder: 100,
    },
    {
      partitionCode: "SANTA_ELENA_OPERATING",
      code: "CASH_MOVEMENTS",
      name: "Cash movements (DEVOLUCIÓN / TRASLADO / ANULADO)",
      budgetAmountUsd: "0",
      budgetPercentage: "0",
      commissionRate: null,
      dashboardVisible: false,
      sortOrder: 101,
    },
  ];
  for (const c of systemCategories) {
    const partitionId = partitionsByCode.get(c.partitionCode);
    if (!partitionId) continue;
    const data = {
      partitionId,
      code: c.code,
      name: c.name,
      budgetAmountUsd: c.budgetAmountUsd,
      budgetPercentage: c.budgetPercentage,
      commissionRate: c.commissionRate,
      dashboardVisible: c.dashboardVisible,
      sortOrder: c.sortOrder,
    };
    const id = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ex = await tx.budgetCategory.findUnique({
        where: { code: c.code },
        select: { id: true },
      });
      if (ex) {
        const u = await tx.budgetCategory.update({ where: { id: ex.id }, data, select: { id: true } });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "BudgetCategory", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return u.id;
      }
      const created = await tx.budgetCategory.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "BudgetCategory", entityId: created.id },
        importStamp,
      );
      return created.id;
    });
    categoriesByCode.set(c.code, id);
  }

  // L3 — BudgetSubItem (empty for now; parser doesn't yet extract sub-items
  // from Ppto Inversion — slated for a future enhancement).
  for (const s of bundle.budgetSubItems) {
    const categoryId = categoriesByCode.get(s.categoryCode);
    if (!categoryId) {
      throw new Error(
        `BudgetSubItem '${s.code}' references unknown category '${s.categoryCode}'.`,
      );
    }
    const data = {
      categoryId,
      code: s.code,
      description: s.description,
      unit: s.unit,
      quantity: s.quantity,
      unitPriceUsd: s.unitPriceUsd,
      totalUsd: s.totalUsd,
      totalGtq: s.totalGtq,
    };
    const id = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ex = await tx.budgetSubItem.findUnique({
        where: { categoryId_code: { categoryId, code: s.code } },
        select: { id: true },
      });
      if (ex) {
        const u = await tx.budgetSubItem.update({
          where: { id: ex.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "BudgetSubItem", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return u.id;
      }
      const created = await tx.budgetSubItem.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "BudgetSubItem", entityId: created.id },
        importStamp,
      );
      return created.id;
    });
    subItemsByCategoryAndCode.set(`${s.categoryCode}|${s.code}`, id);
  }

  return {
    partitionsByCode,
    categoriesByCode,
    subItemsByCategoryAndCode,
    counts: {
      partitions: partitionsByCode.size,
      categories: categoriesByCode.size,
      subItems: subItemsByCategoryAndCode.size,
    },
  };
}
