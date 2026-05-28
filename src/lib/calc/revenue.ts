/**
 * SDD §7.3 — Revenue tracking.
 *
 * Each RvUnit's sale schedule:
 *   - Enganche (~25%) at saleMonth
 *   - Monthly installments from saleMonth → deliveryMonth
 *   - Final payment at deliveryMonth
 *
 * For Santa Elena's current snapshot, only the projected totals + counts
 * are needed for the L0 dashboard. Realization timing is approximated by
 * `now` against `saleMonth` (any unit with saleMonth in the past has had at
 * least the enganche received).
 */

import type { Prisma } from "@prisma/client";

import { decimalAdd, decimalString } from "./currency";
import type { RevenueMetrics } from "./types";

type RvUnitRow = Pick<
  Prisma.RvUnitGetPayload<Record<string, never>>,
  "id" | "name" | "status" | "salePriceSinIvaUsd" | "saleMonth" | "deliveryMonth" | "engancheRate"
>;

export interface RevenueInput {
  projectStartDate: Date;
  now?: Date;
}

export function revenue(units: RvUnitRow[], opts: RevenueInput): RevenueMetrics {
  const now = opts.now ?? new Date();
  const currentMonth = monthsBetween(opts.projectStartDate, now);

  let totalProjected = "0";
  let realized = "0";
  let sold = 0;
  let available = 0;

  const perUnit: RevenueMetrics["perUnit"] = [];
  for (const u of units) {
    const price = decimalString(u.salePriceSinIvaUsd);
    totalProjected = decimalAdd(totalProjected, price);

    if (u.status === "SOLD") sold += 1;
    else if (u.status === "AVAILABLE") available += 1;

    if (u.status === "SOLD" && u.saleMonth != null && u.saleMonth <= currentMonth) {
      // Approximation: enganche realized; installments accrue linearly from
      // saleMonth to deliveryMonth; balance at delivery month. Detailed
      // tranches are computed by `MonthlyProjection.revenuePerHouse` for the
      // dashboard's monthly view — here we only need the cumulative figure
      // for the L0 header.
      const engancheRate = Number(decimalString(u.engancheRate));
      const realizedThisUnit = computeRealizedForUnit({
        price: Number(price),
        engancheRate,
        saleMonth: u.saleMonth,
        deliveryMonth: u.deliveryMonth ?? u.saleMonth,
        currentMonth,
      });
      realized = decimalAdd(realized, realizedThisUnit.toFixed(2));
    }

    perUnit.push({
      id: u.id,
      name: u.name,
      salePriceSinIvaUsd: price,
      status: u.status,
      saleMonth: u.saleMonth,
      deliveryMonth: u.deliveryMonth,
    });
  }

  return {
    totalProjectedSinIvaUsd: totalProjected,
    realizedToDateUsd: realized,
    unitCountSold: sold,
    unitCountAvailable: available,
    perUnit,
  };
}

function computeRealizedForUnit(args: {
  price: number;
  engancheRate: number;
  saleMonth: number;
  deliveryMonth: number;
  currentMonth: number;
}): number {
  const { price, engancheRate, saleMonth, deliveryMonth, currentMonth } = args;
  if (currentMonth < saleMonth) return 0;
  if (currentMonth >= deliveryMonth) return price; // fully realized
  // Linear monthly accrual from saleMonth → deliveryMonth, with enganche at saleMonth
  const enganche = price * engancheRate;
  const balance = price - enganche;
  const installmentsTotal = deliveryMonth - saleMonth; // exclusive of final
  if (installmentsTotal === 0) return enganche;
  const monthsElapsed = currentMonth - saleMonth;
  const installmentsAccrued = (balance / installmentsTotal) * monthsElapsed;
  return enganche + installmentsAccrued;
}

function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}
