/**
 * Per-house conciliación composite query — Batch 13c.
 *
 *   /casa/[id]/conciliacion
 *
 * Loads the RvUnit + its buyer + the 36 monthly projections (to extract
 * the planned cuota schedule for this house from `revenuePerHouse`) + all
 * actual `RvPayment` rows, then runs `reconcileCasa()` to produce the
 * report shape the page renders.
 *
 * Returns `null` if the RvUnit id doesn't exist (or is soft-deleted) —
 * the page calls `notFound()`.
 */

import type { PrismaClient } from "@prisma/client";

import { decimalString } from "../calc/currency";
import {
  reconcileCasa,
  type ActualPaymentInput,
  type PlannedCuotaInput,
  type ReconciliationReport,
} from "../calc/reconciliation";

export interface CasaConciliacionSnapshot {
  unit: {
    id: string;
    name: string;
    status: string;
    salePriceSinIvaUsd: string | null;
    engancheRate: string;
    saleMonth: number | null;
    deliveryMonth: number | null;
    buyer: { id: string; name: string } | null;
  };
  project: {
    startDate: string;
    currentMonth: number;
    lockedExchangeRate: string;
  };
  report: ReconciliationReport;
  /// True when the unit is not SOLD — the page surfaces an explanatory banner
  /// because reconciliation against actual payments is irrelevant (no buyer).
  noBuyerYet: boolean;
}

export async function loadCasaConciliacion(
  prisma: PrismaClient,
  id: string,
  options: { now?: Date } = {},
): Promise<CasaConciliacionSnapshot | null> {
  const now = options.now ?? new Date();

  const unit = await prisma.rvUnit.findFirst({
    where: { id, deletedAt: null },
    include: {
      buyer: { select: { id: true, name: true } },
      payments: {
        where: { deletedAt: null },
        orderBy: { paymentDate: "asc" },
        include: {
          bankTransaction: { select: { id: true } },
        },
      },
    },
  });
  if (unit == null) return null;

  const [project, monthlies] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { startDate: true, lockedExchangeRate: true },
    }),
    prisma.monthlyProjection.findMany({
      where: { deletedAt: null },
      orderBy: { monthNumber: "asc" },
      select: { monthNumber: true, monthDate: true, revenuePerHouse: true },
    }),
  ]);

  const planned: PlannedCuotaInput[] = monthlies.map((m) => {
    const perHouse = (m.revenuePerHouse ?? {}) as Record<string, number | string | null>;
    const raw = perHouse[unit.name];
    const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
    const plannedUsd = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    return {
      monthNumber: m.monthNumber,
      monthDate: m.monthDate.toISOString().slice(0, 10),
      plannedUsd,
    };
  });

  const paymentsInput: ActualPaymentInput[] = unit.payments.map((p) => ({
    id: p.id,
    paymentDate: p.paymentDate.toISOString().slice(0, 10),
    amountUsd: decimalString(p.amountUsd),
    bankTransactionId: p.bankTransaction?.id ?? null,
    reconciliationStatus: p.reconciliationStatus,
    notes: p.notes,
  }));

  const report = reconcileCasa(unit.name, planned, paymentsInput, {
    now,
    projectStartDate: project.startDate,
  });

  const currentMonth = currentProjectMonth(project.startDate, now);
  return {
    unit: {
      id: unit.id,
      name: unit.name,
      status: unit.status,
      salePriceSinIvaUsd:
        unit.salePriceSinIvaUsd != null ? decimalString(unit.salePriceSinIvaUsd) : null,
      engancheRate: decimalString(unit.engancheRate),
      saleMonth: unit.saleMonth,
      deliveryMonth: unit.deliveryMonth,
      buyer: unit.buyer,
    },
    project: {
      startDate: project.startDate.toISOString().slice(0, 10),
      currentMonth,
      lockedExchangeRate: decimalString(project.lockedExchangeRate),
    },
    report,
    noBuyerYet: unit.status !== "SOLD",
  };
}

function currentProjectMonth(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}
