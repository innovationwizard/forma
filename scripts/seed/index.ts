#!/usr/bin/env tsx
/**
 * Batch 6 — seed script.
 *
 *   pnpm seed [path-to-parse-output.json]
 *
 * Default path: scripts/xlsx/output/parse-latest.json (symlink to the
 * latest Batch 5 parser run).
 *
 * Idempotent: re-running the seed against the same parse bundle produces
 * zero net changes (re-seed audit rows are written via `(re-seed)`-tagged
 * fieldName so the AuditLog records the no-op too — full historical traceability).
 *
 * Per D8 every insert is attributed to the synthetic XLSX_IMPORT user.
 * Per D21 nothing is hard-deleted. Per D31 the parser already captured
 * anomalies as flags; the seed PRESERVES every flag as a DataQualityFlag
 * row (does not filter or merge).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { writeImportAuditLog, buildImportStamp } from "./audit";
import { seedBankAccounts } from "./entities/bank-accounts";
import { seedBudget } from "./entities/budget";
import { seedCreditFacilities } from "./entities/credit-facility";
import { seedDataQualityFlags } from "./entities/data-quality-flags";
import { seedExpenditures } from "./entities/expenditures";
import { seedIsrObligations } from "./entities/isr-obligations";
import { seedMonthlyProjections } from "./entities/monthly-projections";
import { seedPartnerContributions } from "./entities/partner-contributions";
import { seedPartners } from "./entities/partners";
import { seedProject } from "./entities/project";
import { seedRvUnits } from "./entities/rv-units";
import { ensureXlsxImportUser } from "./system-user";
import { parseBundleSchema, type ValidatedParseBundle } from "./types";
import { validateSeed } from "./validate";

const DEFAULT_PARSE_OUTPUT = resolve(__dirname, "../xlsx/output/parse-latest.json");

async function main(): Promise<void> {
  const arg = process.argv[2];
  const bundlePath = arg ? resolve(arg) : DEFAULT_PARSE_OUTPUT;

  if (!existsSync(bundlePath)) {
    process.stderr.write(
      `FATAL: parser output not found: ${bundlePath}\n` +
        "Run `pnpm xlsx:parse` first to produce a parse bundle.\n",
    );
    process.exit(2);
  }

  // ── Load + validate ─────────────────────────────────────────────────────
  const raw = JSON.parse(readFileSync(bundlePath, "utf-8"));
  const validation = parseBundleSchema.safeParse(raw);
  if (!validation.success) {
    process.stderr.write(
      "FATAL: parse bundle failed schema validation. The Batch 5 parser may be on a different schemaVersion.\n",
    );
    process.stderr.write(JSON.stringify(validation.error.format(), null, 2) + "\n");
    process.exit(3);
  }
  const bundle: ValidatedParseBundle = validation.data;

  const prisma = new PrismaClient({
    log: ["warn", "error"],
  });

  try {
    const importStamp = buildImportStamp();
    const startTime = Date.now();

    process.stdout.write("━━━ Batch 6 seed ━━━\n");
    process.stdout.write(`Source bundle: ${bundlePath}\n`);
    process.stdout.write(`Parsed at: ${bundle.parsedAt}\n`);
    process.stdout.write(`Import stamp: ${importStamp}\n\n`);

    // ── 1. XLSX_IMPORT user ──────────────────────────────────────────────
    const userId = await ensureXlsxImportUser(prisma);
    await writeImportSummaryLog(prisma, userId, importStamp, "seed_start", "Batch 6 seed initiated");
    process.stdout.write(`[1/12] XLSX_IMPORT user: ${userId}\n`);

    // ── 2. Project ────────────────────────────────────────────────────────
    const projectResult = await seedProject(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[2/12] Project: ${projectResult.created ? "created" : "updated"} (${projectResult.projectId})\n`,
    );

    // ── 3. Budget hierarchy (L1 → L2 → L3) ───────────────────────────────
    const budget = await seedBudget(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[3/12] Budget: ${budget.counts.partitions} partitions, ${budget.counts.categories} categories, ${budget.counts.subItems} sub-items\n`,
    );

    // ── 4. BankAccounts ──────────────────────────────────────────────────
    const bankAccounts = await seedBankAccounts(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[4/12] BankAccounts: ${bankAccounts.created} created, ${bankAccounts.updated} updated (9 expected)\n`,
    );

    // ── 5. Partners (counterparties) ─────────────────────────────────────
    const partners = await seedPartners(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[5/12] Partners: ${partners.created} created, ${partners.updated} updated (${bundle.counterparties.length} total)\n`,
    );

    // ── 6. RvUnits + RvReservations ──────────────────────────────────────
    const rvUnits = await seedRvUnits(prisma, bundle, partners, userId, importStamp);
    process.stdout.write(
      `[6/12] RvUnits: ${rvUnits.unitsCreated} created, ${rvUnits.unitsUpdated} updated; reservations: ${rvUnits.reservationsCreated}\n`,
    );

    // ── 7. MonthlyProjections ────────────────────────────────────────────
    const projections = await seedMonthlyProjections(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[7/12] MonthlyProjections: ${projections.created} created, ${projections.updated} updated (36 expected)\n`,
    );
    if (projections.unmappedCategoryCodes.size > 0) {
      process.stdout.write(
        `        WARN: ${projections.unmappedCategoryCodes.size} unmapped category codes: ${Array.from(projections.unmappedCategoryCodes).join(", ")}\n`,
      );
    }

    // ── 8. CreditFacility + AmortizationRule ─────────────────────────────
    const cf = await seedCreditFacilities(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[8/12] CreditFacility: ${cf.facilitiesCreated}+${cf.facilitiesUpdated}; AmortizationRule: ${cf.rulesCreated}+${cf.rulesUpdated}\n`,
    );

    // ── 9. IsrObligations ────────────────────────────────────────────────
    const isr = await seedIsrObligations(prisma, bundle, projectResult.projectId, userId, importStamp);
    process.stdout.write(
      `[9/12] IsrObligations: ${isr.created} created, ${isr.updated} updated ("ISR 18" + "ISR 25")\n`,
    );

    // ── 10. PartnerContributions ─────────────────────────────────────────
    const pc = await seedPartnerContributions(
      prisma,
      bundle,
      projectResult.projectId,
      partners,
      budget,
      userId,
      importStamp,
    );
    process.stdout.write(
      `[10/12] PartnerContributions: ${pc.created} created, ${pc.updated} updated (${pc.skippedMissingPartner} skipped, missing partner)\n`,
    );

    // ── 11. Expenditures ─────────────────────────────────────────────────
    const exp = await seedExpenditures(
      prisma,
      bundle,
      bankAccounts,
      partners,
      budget,
      userId,
      importStamp,
    );
    process.stdout.write(
      `[11/12] Expenditures: ${exp.created} created, ${exp.updated} updated, ${exp.skipped} skipped\n`,
    );
    if (exp.unmappedPartidaGeneral.size > 0) {
      process.stdout.write(
        `        WARN: ${exp.unmappedPartidaGeneral.size} unmapped PARTIDA GENERAL values: ${Array.from(exp.unmappedPartidaGeneral).slice(0, 5).join(", ")}${exp.unmappedPartidaGeneral.size > 5 ? "..." : ""}\n`,
      );
    }

    // ── 12. DataQualityFlags ─────────────────────────────────────────────
    const dqf = await seedDataQualityFlags(prisma, bundle, userId, importStamp);
    process.stdout.write(
      `[12/12] DataQualityFlags: ${dqf.created} created, ${dqf.updated} updated, ${dqf.orphaned} orphaned (soft-deleted)\n`,
    );

    // ── Validation ───────────────────────────────────────────────────────
    process.stdout.write("\n━━━ Validation ━━━\n");
    const report = await validateSeed(prisma, bundle);
    for (const c of report.checks) {
      const icon = c.pass ? "✓" : "✗";
      const tol = c.tolerance ? ` (tol ${c.tolerance})` : "";
      process.stdout.write(`  ${icon} ${c.name}${tol}\n`);
      if (!c.pass) {
        process.stdout.write(`      expected: ${c.expected}\n`);
        process.stdout.write(`      actual:   ${c.actual}\n`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\nElapsed: ${duration}s\n`);
    if (!report.allPassed) {
      process.stderr.write("✗ One or more validation checks FAILED.\n");
      process.exit(4);
    }
    process.stdout.write("✓ All checks passed.\n");
  } finally {
    await prisma.$disconnect();
  }
}

async function writeImportSummaryLog(
  prisma: PrismaClient,
  userId: string,
  stamp: string,
  marker: string,
  note: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await writeImportAuditLog(
      tx,
      {
        userId,
        entityType: "(seed)",
        // Stable synthetic ID for the seed-marker log row. Distinguishable
        // from real entity IDs.
        entityId: "00000000-0000-4000-8000-000000000000",
        fieldName: marker,
        newValue: note,
      },
      stamp,
    );
  });
}

main().catch((err) => {
  process.stderr.write(
    `FATAL (unexpected): ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + "\n");
  process.exit(1);
});
