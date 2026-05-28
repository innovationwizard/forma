/**
 * SDD §7.1 — Budget health per category.
 *
 *   spent       = SUM(expenditures WHERE general_category = category.code)
 *   remaining   = category.budget - spent
 *   pctConsumed = spent / budget
 *   status      =
 *     pctConsumed > 1.0  → OVER_BUDGET
 *     pctConsumed > 0.80 → AT_RISK
 *     pctConsumed == 0 && project_month > expected_start → DELAYED
 *     pctConsumed == 0   → NOT_STARTED
 *     else               → ON_TRACK
 *
 * Per D31: categories that come back OVER_BUDGET are flagged via visual
 * treatment in the dashboard (canonical order preserved per D25). The
 * calc function returns the raw status; rendering decides the badge.
 *
 * Pure function. Decimal precision: `Decimal` in, `string` out.
 */

import type { Prisma } from "@prisma/client";

import type { BudgetHealthStatus, CategoryHealth, CategoryRow, ExpenditureRow } from "./types";
import { decimalAdd, decimalDiv, decimalString, decimalSub, gt } from "./currency";

/// Per Batch 7.5: PartnerContribution amounts roll into the matching
/// BudgetCategory's "spent" total. For Santa Elena the 2 terreno PCs
/// flip TERRENOS from NOT_STARTED → OVER_BUDGET (matching the OVERSPEND
/// flag the parser already emits).
export type PartnerContributionRow = Pick<
  Prisma.PartnerContributionGetPayload<Record<string, never>>,
  "categoryId" | "amountUsd"
>;

export interface BudgetHealthInput {
  /// Project's current month (1-based). Drives the NOT_STARTED vs DELAYED distinction.
  projectMonth: number;
  /// 1-based month at which a category is "expected to have started spending."
  /// Caller passes a per-category override or this default. Default = 6
  /// (per SDD §2.1: predictability discussion).
  expectedStartMonth?: number;
}

const AT_RISK_PCT = 0.80;
const DEFAULT_EXPECTED_START_MONTH = 6;

export function categoryHealth(
  category: { id: string } & CategoryRow,
  expenditures: ExpenditureRow[],
  opts: BudgetHealthInput,
  partnerContributions: PartnerContributionRow[] = [],
): CategoryHealth {
  const matchingExp = expenditures.filter((e) => e.categoryId === category.id);
  const matchingPc = partnerContributions.filter((p) => p.categoryId === category.id);
  const expSpent = matchingExp.reduce(
    (acc, e) => decimalAdd(acc, decimalString(e.amountUsd)),
    "0",
  );
  const pcSpent = matchingPc.reduce(
    (acc, p) => decimalAdd(acc, decimalString(p.amountUsd)),
    "0",
  );
  const spent = decimalAdd(expSpent, pcSpent);
  const budget = decimalString(category.budgetAmountUsd);
  const remaining = decimalSub(budget, spent);
  const pctConsumed = computePctConsumed(spent, budget);
  const status = classifyStatus({
    spentNum: Number(spent),
    pctConsumed: Number(pctConsumed),
    projectMonth: opts.projectMonth,
    expectedStartMonth: opts.expectedStartMonth ?? DEFAULT_EXPECTED_START_MONTH,
  });

  return {
    code: category.code,
    name: category.name,
    budgetUsd: budget,
    spentUsd: spent,
    remainingUsd: remaining,
    pctConsumed,
    status,
    dashboardVisible: category.dashboardVisible,
    sortOrder: category.sortOrder,
  };
}

export function budgetHealthAll(
  categories: Array<{ id: string } & CategoryRow>,
  expenditures: ExpenditureRow[],
  opts: BudgetHealthInput,
  partnerContributions: PartnerContributionRow[] = [],
): CategoryHealth[] {
  return categories.map((c) => categoryHealth(c, expenditures, opts, partnerContributions));
}

function computePctConsumed(spent: string, budget: string): string {
  const b = Number(budget);
  if (!Number.isFinite(b) || b === 0) {
    // Per Q-IMPUESTOS-NO-BUDGET: when budget=0 but spent>0, we don't divide
    // by zero. Caller's view of "100% overspend" comes from the status =
    // OVER_BUDGET classification below.
    return Number(spent) === 0 ? "0" : "Infinity";
  }
  return decimalDiv(spent, budget);
}

function classifyStatus(args: {
  spentNum: number;
  pctConsumed: number;
  projectMonth: number;
  expectedStartMonth: number;
}): BudgetHealthStatus {
  const { spentNum, pctConsumed, projectMonth, expectedStartMonth } = args;
  // Infinity case: zero budget + non-zero spend (Q-IMPUESTOS-NO-BUDGET).
  // 100% overspend by convention.
  if (!Number.isFinite(pctConsumed) && spentNum > 0) return "OVER_BUDGET";
  if (gt(pctConsumed, 1.0)) return "OVER_BUDGET";
  if (gt(pctConsumed, AT_RISK_PCT)) return "AT_RISK";
  if (spentNum === 0) {
    return projectMonth > expectedStartMonth ? "DELAYED" : "NOT_STARTED";
  }
  return "ON_TRACK";
}
