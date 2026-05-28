/**
 * MonthlyProjection seeder. Idempotent by `monthNumber` (unique constraint).
 * 36 rows for Santa Elena's May-2025 → May-2028 timeline (label-based per D26).
 *
 * Schema-aware mapping:
 *   - The schema has 11 typed cost columns (costTerrenos, costLicencias, ...).
 *   - The parser emits per-category costs as `costByCategoryUsd: Record<code, string>`.
 *   - This seeder maps category code → typed column.
 *   - Revenue per house → `revenuePerHouse` JSONB (matches parser's `revenueByUnitUsd`).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

/// Map from parser-emitted BudgetCategory code → MonthlyProjection schema
/// column name. Keys derived from FCFCasas2 dashboard category names per D25
/// (the 11-category CEO view), normalized via the parser's `toCategoryCode`.
const CATEGORY_CODE_TO_COST_COLUMN: Record<string, string> = {
  TERRENOS: "costTerrenos",
  LICENCIAS_Y_PERMISOS: "costLicencias",
  PLANIFICACION_TECNICA: "costPlanificacion",
  CONSTRUCCIONES_COMPLEMENTARIAS: "costConstruccionesComp",
  CONSTRUCCION: "costConstruccion",
  MERCADEO: "costMercadeo",
  COMISIONES_DE_VENTA: "costComisiones",
  HONORARIOS_LEGALES_ESCRITURACION: "costHonorarios",
  GASTOS_LEGALES: "costGastosLegales",
  DEVELOPMENT_FEE_FORMA_CI: "costDevFee",
  IMPREVISTOS_MISCELANEOS: "costImprevistos",
};

export interface MonthlyProjectionSeedResult {
  created: number;
  updated: number;
  unmappedCategoryCodes: Set<string>;
}

export async function seedMonthlyProjections(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<MonthlyProjectionSeedResult> {
  let created = 0;
  let updated = 0;
  const unmappedCategoryCodes = new Set<string>();

  for (const m of bundle.monthlyProjections) {
    // Distribute per-category costs into typed columns. Anything we can't
    // map gets reported (no data loss; the orchestrator surfaces unmapped
    // codes for manual review per D31).
    const costColumns: Record<string, string> = {
      costTerrenos: "0",
      costLicencias: "0",
      costPlanificacion: "0",
      costConstruccionesComp: "0",
      costConstruccion: "0",
      costMercadeo: "0",
      costComisiones: "0",
      costHonorarios: "0",
      costGastosLegales: "0",
      costDevFee: "0",
      costImprevistos: "0",
    };
    for (const [code, amount] of Object.entries(m.costByCategoryUsd)) {
      const col = CATEGORY_CODE_TO_COST_COLUMN[code];
      if (!col) {
        unmappedCategoryCodes.add(code);
        continue;
      }
      costColumns[col] = amount;
    }

    const data = {
      monthNumber: m.monthNumber,
      monthDate: new Date(m.monthDate),
      ...costColumns,
      totalCostSinIva: m.totalCostSinIvaUsd,
      ivaOnCosts: m.ivaOnCostsUsd,
      totalCostConIva: m.totalCostConIvaUsd,
      cumulativeCostConIva: m.cumulativeCostConIvaUsd,
      revenuePerHouse: m.revenueByUnitUsd as Prisma.InputJsonValue,
      totalRevenueSinIva: m.totalRevenueSinIvaUsd,
      cumulativeRevenue: m.cumulativeRevenueUsd,
      ebitdaConIva: m.ebitdaConIvaUsd,
      ebitda: m.ebitdaUsd,
      creditBalance: m.creditBalanceUsd,
      interestPayment: m.interestPaymentUsd,
      principalPayment: m.principalPaymentUsd,
    };

    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.monthlyProjection.findUnique({
        where: { monthNumber: m.monthNumber },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.monthlyProjection.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "MonthlyProjection", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.monthlyProjection.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "MonthlyProjection", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) created++;
    else updated++;
  }

  return { created, updated, unmappedCategoryCodes };
}
