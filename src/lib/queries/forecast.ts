/**
 * Forecast composite query — Batch 16a (read-only).
 *
 * Loads the 36-month projection + project context + credit facility +
 * runs `projection-runner.ts` to produce the derived series + 4 returns.
 * Single round-trip.
 */

import type { PrismaClient } from "@prisma/client";

import { decimalString } from "../calc/currency";
import {
  fromDbRows,
  runProjection,
  type ProjectionResult,
} from "../calc/projection-runner";

export interface ForecastSnapshot {
  project: {
    startDate: string;
    projectedEndDate: string;
    lockedExchangeRate: string;
  };
  projection: ProjectionResult;
  creditFacility: {
    initialCapUsd: string;
    annualRate: string;
    lenderName: string;
  } | null;
  /// Latest applied amortization rule (Batch 4.5 schema). Informs the
  /// CreditFacilityPanel section of the page.
  amortizationRule: {
    mechanism: string;
    appliesFromMonth: number;
    appliesToMonth: number | null;
  } | null;
}

export async function loadForecastSnapshot(prisma: PrismaClient): Promise<ForecastSnapshot> {
  const [project, monthlies, creditFacility] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { startDate: true, projectedEndDate: true, lockedExchangeRate: true },
    }),
    prisma.monthlyProjection.findMany({
      where: { deletedAt: null },
      orderBy: { monthNumber: "asc" },
      select: {
        monthNumber: true,
        monthDate: true,
        totalCostSinIva: true,
        ivaOnCosts: true,
        totalCostConIva: true,
        totalRevenueSinIva: true,
        ebitda: true,
        ebitdaConIva: true,
        creditBalance: true,
        interestPayment: true,
        principalPayment: true,
      },
    }),
    prisma.creditFacility.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true, initialCapUsd: true, annualRate: true, lenderName: true },
    }),
  ]);

  const projection = runProjection(fromDbRows(monthlies));
  const latestRule =
    creditFacility != null
      ? await prisma.amortizationRule.findFirst({
          where: { facilityId: creditFacility.id, deletedAt: null },
          orderBy: { appliesFromMonth: "desc" },
          select: {
            mechanism: true,
            appliesFromMonth: true,
            appliesToMonth: true,
          },
        })
      : null;

  return {
    project: {
      startDate: project.startDate.toISOString().slice(0, 10),
      projectedEndDate: project.projectedEndDate.toISOString().slice(0, 10),
      lockedExchangeRate: decimalString(project.lockedExchangeRate),
    },
    projection,
    creditFacility: creditFacility
      ? {
          initialCapUsd: decimalString(creditFacility.initialCapUsd),
          annualRate: decimalString(creditFacility.annualRate),
          lenderName: creditFacility.lenderName,
        }
      : null,
    amortizationRule: latestRule
      ? {
          mechanism: latestRule.mechanism,
          appliesFromMonth: latestRule.appliesFromMonth,
          appliesToMonth: latestRule.appliesToMonth,
        }
      : null,
  };
}
