/**
 * SDD §7.5 v0.4 — Credit facility math (development-drawdown with revaluation
 * per N1). NOT "revolving hybrid" — the original SDD v0.3 label was wrong.
 *
 * The active mechanism for Santa Elena is the REVOLVENTE_HIBRIDO
 * `AmortizationRule` per D33 + author's note 2:
 *
 *   monthly_interest = outstanding_balance × (annual_rate / 12)
 *   if monthly_ebitda > 0 AND outstanding_balance > 0:
 *     principal_payment = min(monthly_ebitda, outstanding_balance)
 *   else:
 *     principal_payment = 0
 *
 * LTC may exceed the stated ceiling per Q-LTC-CEILING (real + normal
 * dynamic capital structure, NOT alarm).
 */

import type { Prisma } from "@prisma/client";

import type { CreditFacilityState, MonthlyProjectionRow } from "./types";
import { decimalDiv, decimalMul, decimalString, decimalSub } from "./currency";

type CreditFacilityRow = Pick<
  Prisma.CreditFacilityGetPayload<Record<string, never>>,
  "id" | "lenderName" | "initialCapUsd" | "currentCapUsd" | "annualRate" | "ltcCeiling"
>;

type AppraisalRow = Pick<
  Prisma.AppraisalGetPayload<Record<string, never>>,
  "facilityId" | "appraisedValueUsd" | "cycleNumber" | "appraisalDate"
>;

export interface CreditFacilityInput {
  /// The most-recent computed monthly EBITDA — drives the revolvente híbrido
  /// principal payment math.
  latestMonthlyEbitdaUsd: string;
  /// Outstanding balance source. For Santa Elena's current snapshot:
  ///   `Ppto Inversion!ED80 = 0` (no drawdowns yet) — partner equity has
  ///   covered everything pre-credit.
  outstandingBalanceUsd: string;
  /// Most-recent appraisal (for LTC computation). Optional — when null,
  /// LTC reports as 0 and stress-zone is false.
  latestAppraisal?: AppraisalRow | null;
}

export function creditFacilityState(
  facility: CreditFacilityRow,
  opts: CreditFacilityInput,
): CreditFacilityState {
  const annualRate = decimalString(facility.annualRate);
  const monthlyRate = decimalDiv(annualRate, "12");
  const monthlyInterest = decimalMul(opts.outstandingBalanceUsd, monthlyRate);

  const principalPayment = computePrincipalPayment({
    monthlyEbitdaUsd: opts.latestMonthlyEbitdaUsd,
    outstandingBalanceUsd: opts.outstandingBalanceUsd,
  });

  const appraisalUsd = opts.latestAppraisal
    ? decimalString(opts.latestAppraisal.appraisedValueUsd)
    : "0";
  const ltc = Number(appraisalUsd) === 0 ? "0" : decimalDiv(opts.outstandingBalanceUsd, appraisalUsd);
  const ltcCeiling = decimalString(facility.ltcCeiling);
  const inStressZone = Number(ltc) > Number(ltcCeiling);

  return {
    facilityId: facility.id,
    lenderName: facility.lenderName,
    initialCapUsd: decimalString(facility.initialCapUsd),
    currentBalanceUsd: opts.outstandingBalanceUsd,
    monthlyInterestUsd: monthlyInterest,
    monthlyPrincipalPaymentUsd: principalPayment,
    currentLtc: ltc,
    ltcCeiling,
    inStressZone,
  };
}

export function computePrincipalPayment(args: {
  monthlyEbitdaUsd: string;
  outstandingBalanceUsd: string;
}): string {
  const ebitda = Number(args.monthlyEbitdaUsd);
  const balance = Number(args.outstandingBalanceUsd);
  if (!Number.isFinite(ebitda) || !Number.isFinite(balance)) return "0";
  if (ebitda <= 0 || balance <= 0) return "0";
  return Math.min(ebitda, balance).toFixed(2);
}

/// Computes a projection's worth of credit-facility math from a stream of
/// monthly projections. For each month, applies the EBITDA-sweep rule to
/// produce a synthetic balance trajectory. Useful for the dashboard's
/// "what would happen if EBITDA stays at X" projection.
export function projectBalanceTrajectory(args: {
  startingBalanceUsd: string;
  monthly: MonthlyProjectionRow[];
}): Array<{ monthNumber: number; balanceUsd: string; principalPaymentUsd: string }> {
  const out: Array<{ monthNumber: number; balanceUsd: string; principalPaymentUsd: string }> = [];
  let balance = args.startingBalanceUsd;
  const sorted = args.monthly.slice().sort((a, b) => a.monthNumber - b.monthNumber);
  for (const m of sorted) {
    const ebitda = decimalString(m.ebitda);
    const principal = computePrincipalPayment({
      monthlyEbitdaUsd: ebitda,
      outstandingBalanceUsd: balance,
    });
    balance = decimalSub(balance, principal);
    if (Number(balance) < 0) balance = "0";
    out.push({
      monthNumber: m.monthNumber,
      balanceUsd: balance,
      principalPaymentUsd: principal,
    });
  }
  return out;
}
