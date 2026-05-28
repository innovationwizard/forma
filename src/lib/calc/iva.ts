/**
 * SDD §7.6 — IVA handling.
 *
 *   Guatemala IVA = 12%
 *   Some expenditures have IVA (services); some don't (govt fees, ISR notes).
 *   Net IVA payable to SAT = IVA cobrado − IVA pagado.
 *
 * `IVA Cobrado` comes from MonthlyProjection.totalRevenueSinIva × ivaRate
 * (12% applied at delivery — see §3.2.4 in the SDD). Per Detalle egresos
 * finding #1, all MONTO values are GTQ; IVA amounts on Expenditure rows are
 * already-paid IVA.
 */

import type { Prisma } from "@prisma/client";

import type { IvaSnapshot } from "./types";
import { decimalAdd, decimalDiv, decimalMul, decimalString, decimalSub } from "./currency";

type ExpenditureIvaRow = Pick<
  Prisma.ExpenditureGetPayload<Record<string, never>>,
  "ivaAmount" | "exchangeRate" | "exchangeRateAtTransaction"
>;

type MonthlyRevenueRow = Pick<
  Prisma.MonthlyProjectionGetPayload<Record<string, never>>,
  "totalRevenueSinIva"
>;

export interface IvaInput {
  /// Project's locked TC, used to convert GTQ IVA pagado → USD.
  lockedExchangeRate: string;
  /// IVA rate (e.g., 0.12 for Guatemala).
  ivaRate: string;
}

export function ivaSnapshot(
  expenditures: ExpenditureIvaRow[],
  monthlyRevenue: MonthlyRevenueRow[],
  opts: IvaInput,
): IvaSnapshot {
  // ── IVA cobrado: rate × total revenue sin IVA ─────────────────────────
  const totalRevenueSinIva = monthlyRevenue.reduce(
    (acc, m) => decimalAdd(acc, decimalString(m.totalRevenueSinIva)),
    "0",
  );
  const ivaCobrado = decimalMul(totalRevenueSinIva, opts.ivaRate);

  // ── IVA pagado: sum of Expenditure.ivaAmount (in GTQ), USD-converted ──
  let ivaPagadoUsd = "0";
  for (const e of expenditures) {
    const gtq = decimalString(e.ivaAmount);
    const tc = e.exchangeRateAtTransaction ?? e.exchangeRate;
    const tcStr = decimalString(tc);
    const tcNum = Number(tcStr);
    if (!Number.isFinite(tcNum) || tcNum === 0) continue;
    const usd = decimalDiv(gtq, tcStr);
    ivaPagadoUsd = decimalAdd(ivaPagadoUsd, usd);
  }

  const net = decimalSub(ivaCobrado, ivaPagadoUsd);

  return {
    ivaCobradoUsd: ivaCobrado,
    ivaPagadoUsd,
    netIvaPayableUsd: net,
  };
}
