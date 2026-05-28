/**
 * SDD §7.7 v0.4 — Currency conversion with 4-source TC ambiguity.
 *
 * Four distinct TC values exist for Santa Elena:
 *   1. lockedExchangeRate (Project.lockedExchangeRate, default 7.7)        — "advertised"
 *   2. tcBudgetaryLabel (Project.tcBudgetaryLabel = "TC 7.8 PARA PRESUPUESTO") — info-only
 *   3. tcEffectiveTerrenoHistorical (Project.tcEffectiveTerrenoHistorical = 7.6922) — historical
 *   4. Per-transaction TC (Expenditure.exchangeRateAtTransaction) — actual at recording time
 *
 * USD reconstruction prefers per-transaction TC where present (Detalle
 * egresos finding #11 — 20+ transactions). Falls back to lockedExchangeRate
 * otherwise.
 *
 * Currency variance = (actualTc − lockedTc) × amountGtq / actualTc, reportable
 * per-transaction or aggregated.
 *
 * Also exports the shared `Decimal`-string helpers used across the calc layer
 * (decimalAdd/Sub/Mul/Div/string/gt). These exist because `Prisma.Decimal`
 * is the type at the boundary; inside calc bodies we stay in `number` for
 * speed, but emit `string` at the edges per Rule 8 (no IEEE-754 for money).
 */

import type { Prisma } from "@prisma/client";

import type { CurrencyVariance, ExpenditureRow } from "./types";

// ── Pure Decimal helpers ────────────────────────────────────────────────

export function decimalString(value: Prisma.Decimal | string | number | null | undefined): string {
  if (value == null) return "0";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "0";
  }
  if (typeof value === "string") return value;
  return value.toString();
}

export function decimalAdd(a: string, b: string): string {
  return (Number(a) + Number(b)).toString();
}

export function decimalSub(a: string, b: string): string {
  return (Number(a) - Number(b)).toString();
}

export function decimalMul(a: string, b: string): string {
  return (Number(a) * Number(b)).toString();
}

export function decimalDiv(a: string, b: string): string {
  const bn = Number(b);
  if (bn === 0) return "0";
  return (Number(a) / bn).toString();
}

export function gt(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && a > b;
}

/// USD reconstruction for a single Expenditure: prefer per-tx TC, fall back
/// to project locked TC.
export function reconstructUsd(args: {
  amountGtq: string;
  exchangeRateAtTransaction: string | null;
  lockedExchangeRate: string;
}): string {
  const tc = args.exchangeRateAtTransaction ?? args.lockedExchangeRate;
  const tcNum = Number(tc);
  if (!Number.isFinite(tcNum) || tcNum === 0) return "0";
  return (Number(args.amountGtq) / tcNum).toFixed(2);
}

/// Per-transaction variance: (actualTc − lockedTc) × amountGtq / actualTc
/// (rendered in USD terms). Returns a signed number — positive means the
/// actual TC was higher than locked (USD cheaper than locked baseline).
export function transactionVarianceUsd(args: {
  amountGtq: string;
  actualTc: string;
  lockedTc: string;
}): string {
  const actual = Number(args.actualTc);
  const locked = Number(args.lockedTc);
  const gtq = Number(args.amountGtq);
  if (!Number.isFinite(actual) || actual === 0) return "0";
  if (!Number.isFinite(locked)) return "0";
  return ((actual - locked) * (gtq / actual)).toFixed(2);
}

export function currencyVarianceTotals(
  expenditures: Array<ExpenditureRow & { sourceWorkbookRef: string | null; vendorRaw: string }>,
  lockedTc: string,
  topN = 10,
): CurrencyVariance {
  const perRow = expenditures
    .filter((e) => e.exchangeRateAtTransaction != null)
    .map((e) => {
      const actualTc = decimalString(e.exchangeRateAtTransaction);
      const variance = transactionVarianceUsd({
        amountGtq: decimalString(e.amountSinIva),
        actualTc,
        lockedTc,
      });
      return {
        sourceWorkbookRef: e.sourceWorkbookRef ?? "(no source ref)",
        counterpartyName: e.vendorRaw,
        actualTc,
        lockedTc,
        varianceUsd: variance,
      };
    });

  const total = perRow.reduce((acc, r) => decimalAdd(acc, r.varianceUsd), "0");
  const top = perRow
    .slice()
    .sort((a, b) => Math.abs(Number(b.varianceUsd)) - Math.abs(Number(a.varianceUsd)))
    .slice(0, topN);

  return { totalVarianceUsd: total, topContributors: top };
}
