#!/usr/bin/env tsx
/**
 * Batch 5 XLSX parser — entry point.
 *
 *   pnpm xlsx:parse [path]
 *
 * Default path: docs/REFLUJO/04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2.xlsx
 *
 * Per D31:
 *   THE PARSER DOES NOT FAIL — neither loudly nor silently.
 *
 * What's allowed to throw: real I/O failures (file missing, file unreadable,
 * OOM). That's it.
 *
 * What's NEVER allowed to throw or skip: missing fields, type mismatches,
 * stale formulas, broken references, calendar gaps, negative amounts, ANULADO
 * statuses, missing FKs, color-coded warnings, unrecognized partidas,
 * broken VLOOKUPs, off-by-one timeline windows. ALL become rows in the
 * output with appropriate flags.
 *
 * Acceptance criteria (per PLAN.md Batch 5 v0.4):
 *   - 11 budget categories totaling $11,228,641.51 sin IVA
 *   - 11 RvUnits with sale schedule (sold = {1,2,5,6,7,11})
 *   - Total projected revenue $12,639,661.49
 *   - 242 Expenditure rows totaling $2,001,163.72 USD (Ppto Inversion row 135)
 *   - 2+ PartnerContribution rows (2018 + 2025 terreno events)
 *   - 9 BankAccount rows (6 active + 3 legacy)
 *   - 5 NOTAS captured verbatim
 *   - Per-tx TC extracted for ≥20 transactions
 *   - DataQualityFlag[] populated (informational, not blockers)
 *   - Parser exits 0 on every successful read regardless of anomalies
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import ExcelJS from "exceljs";

import { FlagCollector } from "./flags";
import { writeBundle } from "./output";
import { reconcileAcrossSheets } from "./reconcile";
import { renderReport } from "./report";
import { parseDetalleEgresos } from "./sheets/detalle-egresos";
import { parseFCFCasas2 } from "./sheets/fcfcasas2";
import { parsePptoInversion } from "./sheets/ppto-inversion";
import type { ParseBundle, ParseSummary } from "./types";

const DEFAULT_SOURCE = resolve(
  __dirname,
  "../../docs/REFLUJO/04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2.xlsx",
);

async function main(): Promise<void> {
  const sourceArg = process.argv[2];
  const sourceFile = sourceArg ? resolve(sourceArg) : DEFAULT_SOURCE;

  // The ONLY conditions allowed to fail-loud: real I/O failures.
  if (!existsSync(sourceFile)) {
    process.stderr.write(`FATAL: source file not found: ${sourceFile}\n`);
    process.exit(2);
  }
  const stat = statSync(sourceFile);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourceFile);

  const fcfCasas2Sheet = workbook.getWorksheet("FCFCasas2");
  const pptoInversionSheet = workbook.getWorksheet("Ppto Inversion");
  const detalleEgresosSheet = workbook.getWorksheet("Detalle egresos");

  // If a required sheet is missing, that's a schema-incompatibility — Rule 8
  // says we DO fail loud for "schema entirely incompatible." But we surface
  // it clearly so the operator can re-run on a corrected workbook.
  const missing: string[] = [];
  if (!fcfCasas2Sheet) missing.push("FCFCasas2");
  if (!pptoInversionSheet) missing.push("Ppto Inversion");
  if (!detalleEgresosSheet) missing.push("Detalle egresos");
  if (missing.length > 0) {
    process.stderr.write(
      `FATAL: required sheet(s) missing from workbook: ${missing.join(", ")}. ` +
        "Per N6 the parser reads only FCFCasas2 + Ppto Inversion + Detalle egresos.\n",
    );
    process.exit(3);
  }

  // From here down, per D31, NO data condition causes failure.
  const flags = new FlagCollector();

  const fcfCasas2 = parseFCFCasas2(fcfCasas2Sheet!, flags);
  const pptoInversion = parsePptoInversion(pptoInversionSheet!, flags);
  const detalleEgresos = parseDetalleEgresos(detalleEgresosSheet!, flags);

  // Cross-sheet reconciliation: backfill the historical TC from Ppto
  // Inversion!N4 into the Project, then run the multi-sheet checks.
  // (FCFCasas2's parser left tcEffectiveTerrenoHistorical as null because
  // that data lives on Ppto Inversion.)
  // ExcelJS already read the cell; we just need it in the project metadata.
  const tcHistorical = pptoInversionSheet!.getCell("N4").value;
  fcfCasas2.project.tcEffectiveTerrenoHistorical = decimalString(tcHistorical);

  const reconciliations = reconcileAcrossSheets(detalleEgresos, pptoInversion, fcfCasas2, flags);

  // ── Compile the bundle ───────────────────────────────────────────────────
  const flagsSnapshot = flags.snapshot();
  const summary: ParseSummary = {
    totalsUsd: {
      // FCFCasas2!H22 + Ppto Inversion!H62 = 11,228,641.51 (canonical SE budget)
      budgetSinIva: sumBudgetUsd(fcfCasas2.budgetCategories),
      // Ppto Inversion!H135 grand actuals per N3 — live total
      actualExecuted: pptoInversion.grandActualsUsd ?? "0",
      // FCFCasas2!H47 + Ppto Inversion!H76 — projected revenue
      projectedRevenue: sumRvUnitPricesUsd(fcfCasas2.rvUnits),
    },
    totalsGtq: {
      actualExecuted: pptoInversion.totalAFechaGtq ?? "0",
    },
    counts: {
      bankAccounts: detalleEgresos.bankAccounts.length,
      counterparties: detalleEgresos.counterparties.length,
      budgetCategories: fcfCasas2.budgetCategories.length,
      rvUnits: fcfCasas2.rvUnits.length,
      monthlyProjections: fcfCasas2.monthlyProjections.length,
      expenditures: detalleEgresos.expenditures.length,
      partnerContributions: detalleEgresos.partnerContributions.length,
      creditFacilities: fcfCasas2.creditFacilities.length,
      amortizationRules: fcfCasas2.amortizationRules.length,
      isrObligations: fcfCasas2.isrObligations.length,
      dataQualityFlags: flagsSnapshot.length,
      crossSheetReconciliations: reconciliations.length,
    },
    flagsByKind: flags.byKind(),
    flagsBySeverity: flags.bySeverity(),
  };

  const bundle: ParseBundle = {
    schemaVersion: "1.0.0",
    parsedAt: new Date().toISOString(),
    sourceFile,
    sourceFileSize: stat.size,
    sourceFileMtime: stat.mtime.toISOString(),
    project: fcfCasas2.project,
    bankAccounts: detalleEgresos.bankAccounts,
    counterparties: detalleEgresos.counterparties,
    budgetExecutionPartitions: fcfCasas2.budgetExecutionPartitions,
    budgetCategories: fcfCasas2.budgetCategories,
    budgetSubItems: [], // populated by future enhancement of ppto-inversion parser
    rvUnits: fcfCasas2.rvUnits,
    rvReservations: [], // RESERVAS workbook is a separate future batch
    monthlyProjections: fcfCasas2.monthlyProjections,
    expenditures: detalleEgresos.expenditures,
    partnerContributions: detalleEgresos.partnerContributions,
    creditFacilities: fcfCasas2.creditFacilities,
    amortizationRules: fcfCasas2.amortizationRules,
    isrObligations: fcfCasas2.isrObligations,
    dataQualityFlags: flagsSnapshot,
    crossSheetReconciliations: reconciliations,
    summary,
  };

  const { outputPath, bytesWritten } = writeBundle(bundle);
  process.stdout.write(renderReport(bundle, outputPath, bytesWritten));
}

function sumBudgetUsd(cats: { budgetAmountUsd: string }[]): string {
  return cats.reduce((acc, c) => acc + (Number(c.budgetAmountUsd) || 0), 0).toFixed(2);
}

function sumRvUnitPricesUsd(units: { salePriceSinIvaUsd: string | null }[]): string {
  return units
    .reduce((acc, u) => acc + (u.salePriceSinIvaUsd ? Number(u.salePriceSinIvaUsd) || 0 : 0), 0)
    .toFixed(2);
}

function decimalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "object" && value !== null && "result" in value) {
    return decimalString((value as { result: unknown }).result);
  }
  return null;
}

main().catch((err) => {
  // Per Rule 8: real I/O failures fail loud. This catch only fires for
  // unexpected exceptions (e.g., out-of-memory while reading a corrupted
  // xlsx). DATA-quality issues never reach here — they're flagged inline.
  process.stderr.write(`FATAL (real I/O failure): ${err instanceof Error ? err.message : String(err)}\n`);
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + "\n");
  process.exit(1);
});
