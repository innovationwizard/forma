/**
 * SDD §7.8 v0.4 — ISR handling per D34.
 *
 * Both `ISR 18` and `ISR 25` are deliberate per Federico. The UI surfaces
 * them as LITERAL labels — never "Effective" / "Nominal" — per
 * `feedback_literal_labels_when_multiple_values`.
 *
 * Forecast math (the model's lump-end-at-month-36 pattern):
 *   preTaxProfitBasis = SUM(monthly pre-tax cash flow)
 *                     ≈ SUM(EBITDA − interest) per the FCFCasas2 chain
 *   projectedIsr      = preTaxProfitBasis × effectiveRate
 *
 * The "which rate to apply when" disambiguation is pending Federico's
 * clarification. Until then, the calc layer uses the EFFECTIVE rate
 * (currently 0.18) for the projected total. Both rates are returned so the
 * dashboard can display them literally.
 */

import type { Prisma } from "@prisma/client";

import { decimalAdd, decimalMul, decimalString } from "./currency";
import type { IsrSnapshot, MonthlyProjectionRow } from "./types";

interface IsrObligationRow {
  uiLabel: string;
  rate: Prisma.Decimal | string | number;
  rateKind: "EFFECTIVE" | "NOMINAL" | "REGIMEN_SPECIFIC";
  sourceCell: string;
  paymentPattern: "LUMP_END" | "QUARTERLY" | "ANNUAL" | "CUSTOM_TRIGGER" | "COMPOSITE";
}

export interface IsrInput {
  obligations: IsrObligationRow[];
  /// Monthly projections — pre-tax profit basis = sum of monthly EBITDA
  /// minus accrued interest. For Santa Elena's current snapshot, EBITDA
  /// (post-IVA) ≈ pre-tax profit because interest on the credit facility
  /// is small relative to operating cash flow.
  monthly: MonthlyProjectionRow[];
}

export function isrSnapshot(input: IsrInput): IsrSnapshot {
  const obligations = input.obligations.map((o) => ({
    uiLabel: o.uiLabel,
    rate: decimalString(o.rate),
    sourceCell: o.sourceCell,
    appliedIfPattern: o.paymentPattern,
  }));

  // Pre-tax profit basis = sum(monthly EBITDA − interest).
  // EBITDA already nets out IVA per the schema's `ebitda` field. Subtract
  // accrued interest from the credit facility.
  let basis = "0";
  for (const m of input.monthly) {
    const ebitda = decimalString(m.ebitda);
    const interest = decimalString(m.interestPayment);
    basis = decimalAdd(basis, ebitda);
    basis = (Number(basis) - Number(interest)).toString();
  }
  if (Number(basis) < 0) basis = "0"; // ISR doesn't compute on a loss

  // For the projection, prefer EFFECTIVE rate (currently 0.18). If no
  // EFFECTIVE obligation exists, fall back to the first obligation in the
  // list to keep the calc total — never zero — per D31 (never drop data).
  const effective = input.obligations.find((o) => o.rateKind === "EFFECTIVE") ?? input.obligations[0];
  const projectedIsr = effective ? decimalMul(basis, decimalString(effective.rate)) : "0";

  return {
    obligations,
    projectedTotalIsrUsd: projectedIsr,
    preTaxProfitBasisUsd: basis,
  };
}
