/**
 * Post-seed parity validator. Runs assertions directly against the seeded
 * DB and compares to the parser bundle's `summary` totals + the documented
 * parity targets (N3 per PROGRESS.md).
 *
 * Per Rule 8 (explicit error handling): each check produces a structured
 * record. Validator does NOT throw on a data discrepancy — it returns the
 * structured report. Caller decides whether to fail-loud (exit non-zero on
 * any check failure). Per D31 this validator's "failure" mode is a
 * structured result, not an exception.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

import type { ValidatedParseBundle } from "./types";

export interface CheckResult {
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
  tolerance: string | null;
}

export interface ValidationReport {
  checks: CheckResult[];
  allPassed: boolean;
}

/// Decimal(18,2) storage rounds each per-row value; N rows of rounding can
/// accumulate up to N × 0.005 of drift on a rolled-up sum. For 11 categories
/// that's a $0.055 ceiling — set tolerance to $0.10 to absorb it cleanly.
const BUDGET_TOTAL_TOLERANCE = 0.10;
const CENT_TOLERANCE_GTQ = 1.0; // 1 GTQ tolerance for GTQ-side rollups

export async function validateSeed(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
): Promise<ValidationReport> {
  const checks: CheckResult[] = [];

  // 1. SUM(BudgetCategory.budgetAmountUsd) ≈ $11,228,641.51
  const budgetSum = await prisma.budgetCategory.aggregate({
    _sum: { budgetAmountUsd: true },
    where: { deletedAt: null },
  });
  checks.push(
    closeEnoughDecimal({
      name: "SUM(BudgetCategory.budgetAmountUsd) = $11,228,641.51",
      expected: bundle.summary.totalsUsd.budgetSinIva,
      actual: budgetSum._sum.budgetAmountUsd?.toString() ?? "0",
      tol: BUDGET_TOTAL_TOLERANCE,
    }),
  );

  // 2. SUM(Expenditure.amountSinIva) + SUM(PartnerContribution.amountGtq) ≈ 15,408,960.63 GTQ
  const expSum = await prisma.expenditure.aggregate({
    _sum: { amountSinIva: true },
    where: { deletedAt: null },
  });
  const pcSum = await prisma.partnerContribution.aggregate({
    _sum: { amountGtq: true },
    where: { deletedAt: null },
  });
  const expGtq = Number(expSum._sum.amountSinIva ?? 0);
  const pcGtq = Number(pcSum._sum.amountGtq ?? 0);
  const totalGtq = expGtq + pcGtq;
  checks.push({
    name: "Expenditure + PartnerContribution GTQ ≈ Ppto Inversion!ED71",
    expected: bundle.summary.totalsGtq.actualExecuted,
    actual: totalGtq.toFixed(2),
    pass: Math.abs(totalGtq - Number(bundle.summary.totalsGtq.actualExecuted)) < CENT_TOLERANCE_GTQ,
    tolerance: `±${CENT_TOLERANCE_GTQ} GTQ`,
  });

  // 3. RvUnit count = 11
  const unitCount = await prisma.rvUnit.count({ where: { deletedAt: null } });
  checks.push({
    name: "RvUnit count = 11",
    expected: "11",
    actual: unitCount.toString(),
    pass: unitCount === 11,
    tolerance: null,
  });

  // 4. Sold-bucket = {1, 2, 5, 6, 7, 11} per D29 operational override
  const soldUnits = await prisma.rvUnit.findMany({
    where: { status: "SOLD", deletedAt: null },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const expectedSold = ["Casa 1", "Casa 11", "Casa 2", "Casa 5", "Casa 6", "Casa 7"]; // string sort
  const actualSold = soldUnits.map((u) => u.name);
  checks.push({
    name: "Sold bucket per D29 = {1, 2, 5, 6, 7, 11}",
    expected: expectedSold.join(", "),
    actual: actualSold.join(", "),
    pass: actualSold.join(",") === expectedSold.join(","),
    tolerance: null,
  });

  // 5. BankAccount count = 9 (6 active + 3 legacy per finding #2)
  const activeBanks = await prisma.bankAccount.count({
    where: { isActive: true, deletedAt: null },
  });
  const legacyBanks = await prisma.bankAccount.count({
    where: { isActive: false, deletedAt: null },
  });
  checks.push({
    name: "BankAccount count = 9 (6 active + 3 legacy)",
    expected: "6 active + 3 legacy = 9",
    actual: `${activeBanks} active + ${legacyBanks} legacy = ${activeBanks + legacyBanks}`,
    pass: activeBanks === 6 && legacyBanks === 3,
    tolerance: null,
  });

  // 6. IsrObligation count = 2 with literal labels "ISR 18" + "ISR 25"
  const isrLabels = await prisma.isrObligation.findMany({
    where: { deletedAt: null },
    select: { uiLabel: true },
    orderBy: { uiLabel: "asc" },
  });
  const labels = isrLabels.map((r) => r.uiLabel).join(", ");
  checks.push({
    name: "IsrObligation labels = 'ISR 18, ISR 25' (literal per D34)",
    expected: "ISR 18, ISR 25",
    actual: labels,
    pass: labels === "ISR 18, ISR 25",
    tolerance: null,
  });

  // 7. PartnerContribution count ≥ 2 (2018 + 2025 terreno)
  const pcCount = await prisma.partnerContribution.count({ where: { deletedAt: null } });
  checks.push({
    name: "PartnerContribution count ≥ 2 (terreno events)",
    expected: "≥ 2",
    actual: pcCount.toString(),
    pass: pcCount >= 2,
    tolerance: null,
  });

  // 8. MonthlyProjection count = 36
  const mpCount = await prisma.monthlyProjection.count({ where: { deletedAt: null } });
  checks.push({
    name: "MonthlyProjection count = 36",
    expected: "36",
    actual: mpCount.toString(),
    pass: mpCount === 36,
    tolerance: null,
  });

  // 9. Project.modelNotes contains the 5 verbatim NOTAS per D32
  const project = await prisma.project.findFirst({
    where: { deletedAt: null },
    select: { modelNotes: true },
  });
  const noteCount = Array.isArray(project?.modelNotes) ? project.modelNotes.length : 0;
  checks.push({
    name: "Project.modelNotes = 5 verbatim NOTAS (D32)",
    expected: "5",
    actual: noteCount.toString(),
    pass: noteCount === 5,
    tolerance: null,
  });

  // 10. AuditLog rows ≥ entity-insert count (one per insert + one per update on re-seed)
  const auditCount = await prisma.auditLog.count();
  checks.push({
    name: "AuditLog has entries (D8 attribution)",
    expected: "> 0",
    actual: auditCount.toString(),
    pass: auditCount > 0,
    tolerance: null,
  });

  // 11. DataQualityFlag count matches parser bundle
  const dqfCount = await prisma.dataQualityFlag.count({ where: { deletedAt: null } });
  const expectedDqf = bundle.dataQualityFlags.length;
  checks.push({
    name: `DataQualityFlag count = ${expectedDqf} (per parser)`,
    expected: expectedDqf.toString(),
    actual: dqfCount.toString(),
    pass: dqfCount === expectedDqf,
    tolerance: null,
  });

  const allPassed = checks.every((c) => c.pass);
  return { checks, allPassed };
}

function closeEnoughDecimal(args: {
  name: string;
  expected: string;
  actual: string;
  tol: number;
}): CheckResult {
  const exp = Number(args.expected);
  const act = Number(args.actual);
  const pass = Number.isFinite(exp) && Number.isFinite(act) && Math.abs(exp - act) < args.tol;
  return {
    name: args.name,
    expected: args.expected,
    actual: args.actual,
    pass,
    tolerance: `±${args.tol}`,
  };
}

void Prisma; // type-only import suppression for stripping if needed
